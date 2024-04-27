import { createFile, DataStream } from 'mp4box';

class MP4Parser {
  constructor(url, onConfig, onChunk, onKeyframeIndex, onSeek) {
    this.url = url;
    this.onConfig = onConfig;
    this.onChunk = onChunk;
    this.onKeyframeIndex = onKeyframeIndex;
    this.onSeek = onSeek;
    this.mp4boxfile = null;
    this.totalFrames = 0;
    this.currentFrame = 0;
    this.info = null;
    this.keyframeIndex = [];
  }

  async start() {
    try {
      const baseUrl = new URL(import.meta.url);
      const fullUrl = new URL(this.url, baseUrl);
      const response = await fetch(fullUrl);
      const buffer = await response.arrayBuffer();
      const arrayBuffer = buffer;
      arrayBuffer.fileStart = 0;
      this.mp4boxfile = createFile();
      this.mp4boxfile.onMoovStart = this.onMoovStart.bind(this);
      this.mp4boxfile.onReady = this.onReady.bind(this);
      this.mp4boxfile.onError = this.onError.bind(this);
      this.mp4boxfile.appendBuffer(arrayBuffer);
    } catch (error) {
      console.error('Error fetching and parsing MP4 file:', error);
    }
  }

  onMoovStart(info) {
    // Placeholder for the onMoovStart callback in case we need it
  }

  onReady(info) {
    const videoTrack = info.tracks.find((track) => track.type === 'video');
    const trak = this.mp4boxfile.getTrackById(videoTrack.id);
    const description = this.getDescription(trak);
    this.totalFrames = videoTrack.nb_samples;
    const videoConfig = {
      totalFrames: videoTrack.nb_samples,
      fps: this.totalFrames / info.duration * info.timescale,
      trackDuration: info.duration / info.timescale,
      videoWidth: videoTrack.video.width,
      videoHeight: videoTrack.video.height,
      description: description,
    };
    this.onConfig(videoConfig);
    this.mp4boxfile.setExtractionOptions(videoTrack.id);
    this.mp4boxfile.start();
    this.mp4boxfile.onSamples = (id, user, samples) => {

      const indexedFrames = samples.map((sample, index) => {
        if (sample.is_sync) {
          this.keyframeIndex.push(this.currentFrame);
        }
        this.currentFrame++;

          // This is done to render the first frame as soon as possible
          return {
            "frameNum": this.currentFrame - 1,
             "encodedVideoChunk": new EncodedVideoChunk({
              type: sample.is_sync ? 'key' : 'delta',
              timestamp: sample.dts,
              duration: sample.duration,
              data: sample.data,
            }),
            "totalSamples":videoTrack.nb_samples
          }
        ;
      });
      this.onChunk(indexedFrames);
    };
    this.mp4boxfile.flush();
    this.onKeyframeIndex(this.keyframeIndex);
  }

  getDescription(trak) {
    for (const entry of trak.mdia.minf.stbl.stsd.entries) {
      if (entry.avcC || entry.hvcC) {
        const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
        if (entry.avcC) {
          entry.avcC.write(stream);
        } else {
          entry.hvcC.write(stream);
        }
        return new Uint8Array(stream.buffer, 8); // Remove the box header.
      }
    }
    throw "Codec not found";
  }

  onError(error) {
    console.error('MP4BoxFile Error:', error);
  }

  seekToFrame(frameNumber) {
    if (!this.info) return;
    const targetTime = (frameNumber / this.totalFrames) * this.info.duration;
    this.mp4boxfile.seek(targetTime);
    this.currentFrame = frameNumber;
    this.onSeek(frameNumber);
  }

  stop() {
    if (this.mp4boxfile) {
      this.mp4boxfile.stop();
      this.mp4boxfile = null;
    }
  }
}

let mp4parser;

self.onmessage = async (event) => {
  const { type, data } = event.data;
  switch (type) {
    case 'start':
      startDemuxing(data.url);
      break;
    case 'seek':
      seekToFrame(data);
      break;
    default:
      break;
  }
};

function startDemuxing(url) {
  const parsedUrl = new URL(url, self.location.origin);
  mp4parser = new MP4Parser(
    parsedUrl.href,
    // On config callback
    (info) => {
      self.postMessage({ type: 'config', data: info });
    },
    // On chunk callback
    (data) => {
      self.postMessage({ type: 'chunk', data });
    },
    // On keyframe index callback
    (keyframeIndex) => {
      self.postMessage({ type: 'keyframeIndex', data: keyframeIndex });
    },
    // On seek callback
    (frameNumber) => {
      self.postMessage({ type: 'seek', data: frameNumber });
    }
  );
  mp4parser.start();
}

function seekToFrame(frameNumber) {
  if (mp4parser) {
    mp4parser.seekToFrame(frameNumber);
  }
}