import React, { useRef, useReducer, useEffect } from 'react';

const initialState = {
  currentFrameIndex: 0,
  totalFrames: 0,
  fps: 0,
  trackDuration: 0,
  playbackState: 'paused',
  isLoading: true,
  error: null,
  videoDimensions: { width: 0, height: 0 },
  frames: [],
  decodedFrames: [],
  description: null,
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_CONFIG':
      return {
        ...state,
        totalFrames: action.payload.totalFrames,
        fps: action.payload.fps,
        trackDuration: action.payload.trackDuration,
        videoDimensions: {
          width: action.payload.videoWidth,
          height: action.payload.videoHeight,
        },
        isLoading: false,
      };
    case 'ADD_FRAMES':
      return {
        ...state,
        frames: [...state.frames, ...action.payload.frames],
        description: action.payload.description,
      };
    case 'ADD_DECODED_FRAME':
      return {
        ...state,
        decodedFrames: [...state.decodedFrames, action.payload],
      };
    case 'SET_CURRENT_FRAME_INDEX':
      return {
        ...state,
        currentFrameIndex: action.payload,
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };
    case 'SET_PLAYBACK_STATE':
      return {
        ...state,
        playbackState: action.payload,
      };
    default:
      return state;
  }
};

const FramePreciseVideoPlayer = ({ src, codec, renderer }) => {
  const canvasRef = useRef(null);
  const workerRef = useRef(null);
  const currentFrameIndexRef = useRef(0);
  const videoDecoderRef = useRef(null);

  const [state, dispatch] = useReducer(reducer, initialState);
  const [memoryUsage, setMemoryUsage] = React.useState(0);

  useEffect(() => {
    const getMemoryUsage = () => {
      if (performance && performance.memory) {
        const usedJSHeapSize = performance.memory.usedJSHeapSize;
        const jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
        const totalJSHeapSize = performance.memory.totalJSHeapSize;

        const usedMemory = (usedJSHeapSize / (1024 * 1024)).toFixed(2);
        const limitMemory = (jsHeapSizeLimit / (1024 * 1024)).toFixed(2);
        const totalMemory = (totalJSHeapSize / (1024 * 1024)).toFixed(2);

        setMemoryUsage({
          usedMemory,
          limitMemory,
          totalMemory,
        });
      }
    };

    const intervalId = setInterval(getMemoryUsage, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);


  useEffect(() => {
    let playbackIntervalId;

    const playVideo = () => {
      if (currentFrameIndexRef.current < state.decodedFrames.length) {
        const canvas = canvasRef.current;
        if (canvas) {
          const context = canvas.getContext(renderer);
          context.drawImage(
            state.decodedFrames[currentFrameIndexRef.current],
            0,
            0,
            state.videoDimensions.width,
            state.videoDimensions.height
          );
          currentFrameIndexRef.current++;
        }
      }

      if (currentFrameIndexRef.current < state.decodedFrames.length && state.playbackState === 'playing') {
        playbackIntervalId = setTimeout(playVideo, 1000 / state.fps);
      }
    };

    if (state.playbackState === 'playing') {
      playVideo();
    }

    return () => {
      clearTimeout(playbackIntervalId);
    };
  }, [state.playbackState, state.fps, state.decodedFrames, state.videoDimensions, renderer]);

  useEffect(() => {
    const worker = new Worker(new URL('worker', import.meta.url));
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const { type, data } = event.data;
      switch (type) {
        case 'config':
          dispatch({ type: 'SET_CONFIG', payload: data });
          break;
        case 'chunk':
          dispatch({ type: 'ADD_FRAMES', payload: data });
          break;
        case 'error':
          dispatch({ type: 'SET_ERROR', payload: data });
          break;
        default:
          break;
      }
    };

    worker.postMessage({ type: 'start', data: { url: src } });

    return () => {
      worker.terminate();
    };
  }, [src, codec, renderer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = state.videoDimensions.width;
      canvas.height = state.videoDimensions.height;
    }
  }, [state.videoDimensions, renderer]);

  useEffect(() => {
    if (state.videoDimensions.width > 0 && state.videoDimensions.height > 0) {
      videoDecoderRef.current = new VideoDecoder({
        output: (videoFrame) => {
          dispatch({ type: 'ADD_DECODED_FRAME', payload: videoFrame });
        },
        error: (error) => {
          dispatch({ type: 'SET_ERROR', payload: error });
        },
      });
    }
  }, [state.videoDimensions]);

  useEffect(() => {
    const decodeFrames = async () => {
      for (const encodedFrame of state.frames) {
        if (encodedFrame.type === 'key') {
          videoDecoderRef.current.configure({
            codec: codec,
            codedWidth: state.videoDimensions.width,
            codedHeight: state.videoDimensions.height,
            description: state.description,
          });
        }
        await videoDecoderRef.current.decode(encodedFrame);
      }
    };

    decodeFrames();
  }, [state.frames, codec, state.videoDimensions, state.description]);

  const seekToFrame = (frameIndex) => {
    if (frameIndex >= 0 && frameIndex < state.decodedFrames.length) {
      currentFrameIndexRef.current = frameIndex;
      const canvas = canvasRef.current;
      if (canvas) {
        const context = canvas.getContext(renderer);
        context.drawImage(
          state.decodedFrames[frameIndex],
          0,
          0,
          state.videoDimensions.width,
          state.videoDimensions.height
        );
      }
    }
  };

  const handleSeekClick = (direction) => {
    const newFrameIndex =
      direction === 'forward'
        ? currentFrameIndexRef.current + 1
        : currentFrameIndexRef.current - 1;
    seekToFrame(newFrameIndex);
  };

  const getDecodedPercentage = () => {
    if (state.totalFrames === 0) return 0;
    return Math.floor((state.decodedFrames.length / state.totalFrames) * 100);
  };

  if (state.isLoading) {
    return <div>Loading...</div>;
  }

  if (state.error) {
    
    return <div>Error: {state.error.message || 'An error occurred'}</div>;
  }

  return (
    <div className="card bg-base-100 shadow-xl">
      <figure className="px-4 pt-4">
        <canvas ref={canvasRef} className="rounded-xl" />
      </figure>
      <div className="card-body">
        <div className="card-actions justify-center">
          <button
            className="btn btn-primary"
            onClick={() => dispatch({ type: 'SET_PLAYBACK_STATE', payload: 'playing' })}
          >
            Play
          </button>
          <button
            className="btn btn-primary"
            onClick={() => dispatch({ type: 'SET_PLAYBACK_STATE', payload: 'paused' })}
          >
            Pause
          </button>
          <button className="btn btn-primary" onClick={() => handleSeekClick('backward')}>
            Previous Frame
          </button>
          <button className="btn btn-primary" onClick={() => handleSeekClick('forward')}>
            Next Frame
          </button>
        </div>
        <div className="text-center">
          Current Frame: {state.currentFrameIndex} / {state.totalFrames}
        </div>

      </div>
      <div className="card-body">
        {/* ... (existing code) */}
        {memoryUsage.usedMemory && (
          <div className="text-center">
            Memory Usage: {memoryUsage.usedMemory} MB / {memoryUsage.limitMemory} MB
          </div>
        )}
      </div>
      <div className="text-center">
          Decoded Frames: {getDecodedPercentage()}%
        </div>
    </div>
  );
};

export default FramePreciseVideoPlayer;