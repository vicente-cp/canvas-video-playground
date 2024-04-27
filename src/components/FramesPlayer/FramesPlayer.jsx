import React, { useRef, useReducer, useEffect, useState, use } from 'react';

/*
This is a different perspective to the player than that of the FramePreciseVideoPlayer. We will try to be as synchronous as can be.
*/



const FramesPlayer = ({ src, codec, renderer }) => {
  const canvasRef = useRef(null);
  const workerRef = useRef(null);
  const videoDecoderRef = useRef(null);
  const chunksRef = useRef([]);
  const keyframeIndexRef = useRef(null);
  const [config, setConfig] = useState(null);
  const [frameToRender, setFrameToRender] = useState(null);
  const [chunksReady, setChunksReady] = useState(null);





  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && config !== null) {
      canvasRef.current.width = config.width;
      canvasRef.current.height = config.height;
    }
  }, [config, renderer]);
  
  useEffect(() => {
    if (config !== null && videoDecoderRef.current === null){
      videoDecoderRef.current = new VideoDecoder({
        output: (videoFrame) => {
          console.log("Drawing Frame");
          const canvas = canvasRef.current;
          if (canvas) {
            const context = canvas.getContext(renderer);
            context.drawImage(videoFrame, 0, 0);
          }
          videoFrame.close();
        },
        error: (error) => {
          console.log("Error in VideoDecoder", error);
        },
      });
    
    };
  }, [renderer, config]);


  useEffect(() => {
    const worker = new Worker(new URL('worker', import.meta.url));
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const { type, data } = event.data;
      switch (type) {
        case 'config':
          setConfig(data);
          break;
        case 'chunk':
          data.forEach((dataChunk) => {
            if (dataChunk.frameNum === 0) {
              setFrameToRender(dataChunk);
            }

            chunksRef.current = [...chunksRef.current, dataChunk];

          });

          if (chunksRef.current.length === chunksRef.current[0].totalSamples){
            setChunksReady(true); 
          }
          break;
        case 'keyframeIndex':
          keyframeIndexRef.current = data;
          break;
        case 'error':
          console.log("Error in FramesPlayer", data);
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



  const decodeFrame = async (encodedFrame) => {
    await videoDecoderRef.current.decode(encodedFrame);

  };


  useEffect(() => {
    let playbackIntervalId;

    if (chunksReady) {
      const playVideo = async () => {

        for (const chunk of chunksRef.current) {
          await decodeFrame(chunk.encodedVideoChunk);
          await new Promise((resolve) => {
            playbackIntervalId = setTimeout(resolve, 1000 / 25);
          });
        };
      };
  
      playVideo();

  
      return () => {
        clearTimeout(playbackIntervalId);
      };
  


      chunksRef.current.forEach((chunk) => {
        videoDecoderRef.current.decode(chunk.encodedVideoChunk);
      }); 
    }
  }, [chunksReady]);



  useEffect(() => {
    // Since the worker is asynchronous, we may get here before the worker has sent the config message
    if (config !== null && videoDecoderRef.current !== null) {
      if (videoDecoderRef.current.state === 'unconfigured') {
        configureVideoDecoder();
        console.log("Configuring VideoDecoder", videoDecoderRef.current);
        console.log("Frame to render", frameToRender.encodedVideoChunk);
        
        videoDecoderRef.current.decode(frameToRender.encodedVideoChunk);

        
      }
    }

  }, [frameToRender]);


  // useEffect(() => {
    
  //   const canvas = canvasRef.current;
  //   if (canvas && config !== null) {
  //     canvas.width = config.width;
  //     canvas.height = config.height;
  //   }
  // }, [config, renderer]);

  const configureVideoDecoder = async () => {
    await videoDecoderRef.current.configure({
      codec: codec,
      codedWidth: config.width,
      codedHeight: config.height,
      description: config.description,
    });
  };






  const togglePlayback = () => {
    // pass
    console.log("Config in togglePlayback", config);
    console.log("Chunks in togglePlayback", chunksRef.current);
    console.log("KeyframeIndex in togglePlayback", keyframeIndexRef.current);
  }

  return (
    <div className="card bg-base-100 shadow-xl">
      <figure className="px-4 pt-4">
        <canvas ref={canvasRef} className="rounded-xl" />
      </figure>
      <div className="card-body">
        <div className="card-actions justify-center">
          <button className="btn btn-primary" onClick={togglePlayback}>
            Play/Pause</button>
          <button className="btn btn-primary" onClick={() => handleSeekClick('backward')}>
            Previous Frame
          </button>
          <button className="btn btn-primary" onClick={() => handleSeekClick('forward')}>
            Next Frame
          </button>
        </div>
      </div>
    </div>
  );
};

export default FramesPlayer;