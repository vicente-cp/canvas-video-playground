'use client';

import '../styles/globals.css';
import React from 'react';
import FramePreciseVideoPlayer from '../components/FramePreciseVideoPlayer';

const Page = () => {
  const videoSrc = 'media/videos/traffic.mp4';
  const videoCodec = 'avc'; // or 'hevc', 'vp8', 'vp9', 'av1'
  const rendererType = '2d'; // or 'webgl', 'webgpu'

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Frame Precise Video Player</h1>
      <div className="video-player">
        <FramePreciseVideoPlayer src={videoSrc} codec={videoCodec} renderer={rendererType} />
      </div>
      <div className="mt-4">
        <h2 className="text-xl font-bold mb-2">Video Details</h2>
        <p>Source: {videoSrc}</p>
        <p>Codec: {videoCodec}</p>
        <p>Renderer: {rendererType}</p>
      </div>
    </div>
  );
};

export default Page;