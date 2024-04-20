'use client';
import '../styles/globals.css';
import React from 'react';
import FramePreciseVideoPlayer from '../components/FramePreciseVideoPlayer';

const Page = () => {
  const videoSrc = "/media/videos/people_walking.mp4";
  const videoCodec = 'avc'; // or 'hevc', 'vp8', 'vp9', 'av1'
  const rendererType = '2d'; // or 'webgl', 'webgpu'

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800" data-theme="light">
      <header className="navbar bg-white shadow">
        <div className="navbar-start">
          <h1 className="text-2xl">Frame Precise Video Player</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="card bg-white shadow-md">
            <div className="card-body">
              <FramePreciseVideoPlayer src={videoSrc} codec={videoCodec} renderer={rendererType} />
            </div>
          </div>
        </div>
        <div className="card bg-white shadow-md">
          <div className="card-body">
            <h2 className="card-title">Video Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500">Source:</p>
                <p>{videoSrc}</p>
              </div>
              <div>
                <p className="text-gray-500">Codec:</p>
                <p>{videoCodec}</p>
              </div>
              <div>
                <p className="text-gray-500">Renderer:</p>
                <p>{rendererType}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Page;