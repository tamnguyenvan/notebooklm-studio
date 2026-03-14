"use client"
// Need "use client" only if you want this component to use react state. Otherwise, put state logic in child components and mark them "use client".

import Image from "next/image";
import { useEffect, useState } from "react";
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
// import { Command } from '@tauri-apps/api/shell'
// import { appWindow } from '@tauri-apps/api/window'

// When using the Tauri global script (if not using the npm package)
// Be sure to set `app.withGlobalTauri` in `tauri.conf.json` to true
//
// const invoke = window.__TAURI__.core.invoke;
// declare global {
//   interface Window { __TAURI__: any; }
// }

export default function Home() {
  const docs_url = "https://github.com/dieharders/example-tauri-v2-python-server-sidecar";
  const DOMAIN = "localhost";
  const PORT = "8008";
  const [status, setStatus] = useState({ connected: false, info: "" });
  const [logs, setLogs] = useState("[ui] Listening for sidecar & network logs...");
  const connectButtonStyle = status.connected ? "hover:border-yellow-300 hover:bg-yellow-100 hover:dark:border-yellow-400 hover:dark:bg-yellow-500/50 border-dashed" : "hover:border-gray-300 hover:bg-gray-100 hover:dark:border-blue-400 hover:dark:bg-blue-500/50";
  const bgStyle = "bg-[url('/background.svg')] bg-cover bg-fixed bg-center bg-zinc-950";
  const buttonStyle = "group rounded-lg border border-transparent hover:backdrop-blur px-5 py-4 transition-colors text-left";
  const greyHoverStyle = "hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30";
  const descrStyle = "group-hover:opacity-100";

  const initSidecarListeners = async () => {
    // Listen for stdout lines from the sidecar
    const unlistenStdout = await listen('sidecar-stdout', (event) => {
      console.log('Sidecar stdout:', event.payload);
      if (`${event.payload}`.length > 0 && event.payload !== "\r\n")
        setLogs(prev => prev += `\n${event.payload}`)
    });

    // Listen for stderr lines from the sidecar
    const unlistenStderr = await listen('sidecar-stderr', (event) => {
      console.error('Sidecar stderr:', event.payload);
      if (`${event.payload}`.length > 0 && event.payload !== "\r\n")
        setLogs(prev => prev += `\n${event.payload}`)
    });

    // Cleanup listeners when not needed
    return () => {
      unlistenStdout();
      unlistenStderr();
    };
  }

  const apiAction = async (endpoint: string, method: string = 'GET', payload?: any) => {
    const url = `http://${DOMAIN}:${PORT}/${endpoint}`;
    try {
      const body = payload ? JSON.stringify(payload) : null;
      const headers = {
        "Content-Type": "application/json",
      };

      const res = await fetch(url, { method, headers, body });
      if (!res.ok) {
        throw new Error(`Response status: ${res.status}`);
      }
      const json = await res.json();
      console.log(json);
      // Success
      if (json?.message) {
        setLogs(prev => prev += `\n[server-response] ${json.message}`);
      }
      return json;
    } catch (err) {
      console.error(`[server-response] ${err}`);
      setLogs(prev => prev += `\n[server-response] ${err}`);
    }
  }

  const connectServerAction = async () => {
    try {
      const result = await apiAction("v1/connect");
      if (result) {
        setStatus({
          connected: true,
          info: `Host: ${result.data.host}\nProcess id: ${result.data.pid}\nDocs: ${result.data.host}/docs`,
        });
      }
      return;
    } catch (err) {
      console.error(`[ui] Failed to connect to api server. ${err}`);
    }
  }

  const shutdownSidecarAction = async () => {
    try {
      const result = await invoke("shutdown_sidecar");
      if (result) setStatus({
        connected: false,
        info: "",
      });
      return;
    } catch (err) {
      console.error(`[ui] Failed to shutdown sidecar. ${err}`);
    }
  }

  const startSidecarAction = async () => {
    try {
      await invoke("start_sidecar");
      return;
    } catch (err) {
      console.error(`[ui] Failed to start sidecar. ${err}`);
    }
  }

  const mockAPIAction = async () => {
    try {
      await apiAction("v1/completions", "POST", { prompt: "An example query." });
      return;
    } catch (err) {
      console.error(`[ui] Failed to get llm completion. ${err}`);
    }
  }

  // Start listening for server logs
  useEffect(() => {
    initSidecarListeners()
  }, [])

  // Listen for user key inputs and set full screen.
  useEffect(() => {
    const listener = (event: any) => {
      if (event.key === 'F11') {
        event.preventDefault(); // Prevent browser default behavior
        invoke('toggle_fullscreen');
      }
    }
    window.addEventListener('keydown', listener);
    // Cleanup
    return () => {
      window.removeEventListener('keydown', listener);
    }
  }, [])


  // Start python api server. @TODO Update this for v2
  // This does the same shutdown procedure as in main.rs.
  // useEffect(() => {
  //   const start = async () => {
  //     // const { Command } = window.__TAURI__.shell;
  //     const command = Command.sidecar("bin/api/main");
  //     const { stdout, stderr } = await command.execute();
  //     console.log('stdout:', stdout, stderr);
  //     await appWindow.onCloseRequested(async (event) => {
  //       console.log('onCloseRequested', event);
  //       // shutdown the api server
  //       // shutdownSidecarAction()
  //       return
  //     })
  //     return;
  //   }
  //   start()
  // }, [])

  return (
    <main className={`relative flex min-h-screen flex-col items-center justify-between p-24 overflow-hidden ${bgStyle}`}>
      {/* Spinning Background */}
      <div className={`absolute flex justify-center items-center left-[50%] right-[50%] bottom-[50%] top-[50%] w-[0px] h-[0px]`}>
        <div className={`relative w-[100vw] h-[100vw] ${bgStyle} aspect-square animate-[spin_025s_linear_infinite]`}></div>
      </div>
      {/* Header/Footer */}
      <div className="z-20 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        {/* About */}
        <div className="fixed left-0 top-0 flex flex-col items-center lg:items-start w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          <p>
            Get started by editing&nbsp;
            <code className="font-mono font-bold text-yellow-300">src/backends/main.py</code>
          </p>
          <a href={docs_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the project docs:&nbsp;
            <code className="font-mono font-bold text-yellow-300">here</code>
          </a>
        </div>
        {/* Title and Logo */}
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:h-auto lg:w-auto lg:bg-none pointer-events-none">
          <div
            className="flex place-items-center gap-2 p-8 lg:p-0"
          >
            <div>
              <a className="pointer-events-auto" href="https://sorob.net" target="_blank" rel="noopener noreferrer">
                tauri python sidecar
                <br></br>
                by @DIEHARDERS
              </a>
              <br></br>
              <a className="pointer-events-auto" href="https://www.svgbackgrounds.com" target="_blank" rel="noopener noreferrer">
                BG by svgbackgrounds.com
              </a>
            </div>
            <Image
              src="/logo.svg"
              alt="App Logo"
              className="dark"
              width={64}
              height={64}
              priority
            />
          </div>
        </div>
      </div>

      {/* Area displaying logs from server */}
      <code className="relative flex max-w-[1200px] max-h-96 font-mono font-bold border dark:border-neutral-800 border-gray-300 rounded-lg backdrop-blur-2xl dark:bg-zinc-800/30 bg-neutral-400/30 p-4 mt-4 mb-4 whitespace-pre-wrap overflow-y-auto">{logs}</code>

      <div className="z-10 mb-32 grid lg:mb-0 lg:grid-cols-4 items-start">
        {/* Connect to server button */}
        <button
          className={`${buttonStyle} ${connectButtonStyle}`}
          disabled={status.connected}
          onClick={connectServerAction}
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            {status.connected ? "Connected " : "Connect to host"}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50 whitespace-pre-wrap ${descrStyle}`}>
            {status.connected ? status.info : "Establish connection to api server."}
          </p>
        </button>
        {/* Mock api endpoint button */}
        <button
          className={`${buttonStyle} ${greyHoverStyle}`}
          onClick={mockAPIAction}
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Mock API{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50  ${descrStyle}`}>
            Example api server response from mock endpoint.
          </p>
        </button>
        {/* Start sidecar process button */}
        <button
          className={`${buttonStyle} hover:border-gray-300 hover:bg-gray-100 hover:dark:border-green-500 hover:dark:bg-green-500/50`}
          onClick={startSidecarAction}
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Start Sidecar{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50  ${descrStyle}`}>
            Initialize a new sidecar process.
          </p>
        </button>
        {/* Shutdown sidecar process button */}
        <button
          className={`${buttonStyle} hover:border-gray-300 hover:bg-gray-100 hover:dark:border-red-500 hover:dark:bg-red-500/50`}
          onClick={shutdownSidecarAction}
        >
          <h2 className={`mb-3 text-2xl font-semibold`}>
            Stop Sidecar{" "}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-50  ${descrStyle}`}>
            Force close the sidecar process.
          </p>
        </button>
      </div>
    </main>
  );
}
