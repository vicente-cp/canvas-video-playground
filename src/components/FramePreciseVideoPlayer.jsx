import React, { useRef, useReducer, useEffect, useState } from 'react';

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
  keyframeIndex: [],
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
    case 'SET_KEYFRAME_INDEX':
      return {
        ...state,
        keyframeIndex: action.payload,
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
  const [renderFrame, setRenderFrame] = useState(true);

  useEffect(() => {
    let playbackIntervalId;

    const playVideo = async () => {
      setRenderFrame(true); // Set the flag to true for rendering all frames during playback
      configureVideoDecoder(); // Configure the VideoDecoder before decoding frames
      while (currentFrameIndexRef.current < state.frames.length) {
        if (state.playbackState !== 'playing') break;
        await decodeFrame(state.frames[currentFrameIndexRef.current]);
        dispatch({ type: 'SET_CURRENT_FRAME_INDEX', payload: currentFrameIndexRef.current });
        currentFrameIndexRef.current++;
        await new Promise((resolve) => {
          playbackIntervalId = setTimeout(resolve, 1000 / state.fps);
        });
      }
    };

    if (state.playbackState === 'playing') {
      playVideo();
    }

    return () => {
      clearTimeout(playbackIntervalId);
    };
  }, [state.playbackState, state.fps, state.frames]);

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
        case 'keyframeIndex':
          dispatch({ type: 'SET_KEYFRAME_INDEX', payload: data });
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
          console.log("Render frame", renderFrame);
          if (renderFrame) {
            const canvas = canvasRef.current;
            if (canvas) {
              const context = canvas.getContext(renderer);
              context.drawImage(
                videoFrame,
                0,
                0,
                state.videoDimensions.width,
                state.videoDimensions.height
              );
            }
          }
          videoFrame.close();
        },
        error: (error) => {
          dispatch({ type: 'SET_ERROR', payload: error });
        },
      });
    // Configure the VideoDecoder before decoding frames
    configureVideoDecoder();
    }
  }, [state.videoDimensions, renderer, renderFrame]);

  const configureVideoDecoder = () => {
    if (state.description) {
      videoDecoderRef.current.configure({
        codec: codec,
        codedWidth: state.videoDimensions.width,
        codedHeight: state.videoDimensions.height,
        description: state.description,
      });
    }
  };

  const decodeFrame = async (encodedFrame) => {
    await videoDecoderRef.current.decode(encodedFrame);
  };

  const seekToFrame = async (frameIndex) => {
    if (frameIndex >= 0 && frameIndex < state.frames.length) {
      currentFrameIndexRef.current = frameIndex;
      setRenderFrame(false);
      dispatch({ type: 'SET_CURRENT_FRAME_INDEX', payload: frameIndex });
    }
  };
  
  useEffect(() => {
    const decodeFramesForSeeking = async () => {
      if (!renderFrame && state.currentFrameIndex >= 0 && state.currentFrameIndex < state.frames.length) {
        // Find the nearest keyframe
        const nearestKeyframeIndex = state.keyframeIndex.reduce((prevIndex, keyframe, currentIndex) => {
          if (keyframe <= state.currentFrameIndex && (prevIndex === -1 || state.currentFrameIndex - keyframe < state.currentFrameIndex - state.keyframeIndex[prevIndex])) {
            return currentIndex;
          }
          return prevIndex;
        }, -1);
  
        const keyframeStart = state.keyframeIndex[nearestKeyframeIndex] || 0;
  
        // Configure the VideoDecoder before decoding frames
        configureVideoDecoder();
  
        // Decode frames from the keyframe to the target frame
        for (let i = keyframeStart; i <= state.currentFrameIndex; i++) {
          await decodeFrame(state.frames[i]);
        }
  
        setRenderFrame(true);
        await decodeFrame(state.frames[state.currentFrameIndex]);
      }
    };
  
    decodeFramesForSeeking();
  }, [state.currentFrameIndex, renderFrame, state.frames, state.keyframeIndex]);
  
  

  const handleSeekClick = async (direction) => {
    const newFrameIndex =
      direction === 'forward'
        ? currentFrameIndexRef.current + 1
        : currentFrameIndexRef.current - 1;
    await seekToFrame(newFrameIndex);
  };

  const togglePlayback = () => {
    const newPlaybackState = state.playbackState === 'playing' ? 'paused' : 'playing';
    dispatch({ type: 'SET_PLAYBACK_STATE', payload: newPlaybackState });
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
          <button className="btn btn-primary" onClick={togglePlayback}>
            {state.playbackState === 'playing' ? 'Pause' : 'Play'}
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
    </div>
  );
};

export default FramePreciseVideoPlayer;