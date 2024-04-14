import React from 'react';
import "../styles/globals.css";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      <div className="flex flex-col items-center justify-center w-full h-full">
        <h1 className="text-5xl font-bold">Hello, World!</h1>
        <p className="text-lg">Welcome to your new project.</p>
      </div>
    </main>
  );
}
