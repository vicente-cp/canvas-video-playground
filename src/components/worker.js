import { createFile, DataStream } from 'mp4box';

class MP4Demuxer {
  constructor(url, onConfig, onChunk, onKeyframeIndex, onSeek) {
    this.url = url;
    this.onConfig = onConfig;
    this.onChunk = onChunk;
    this.onKeyframeIndex = onKeyframeIndex;
    this.onSeek = onSeek;
    this.demuxer = null;
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
      this.demuxer = createFile();
      this.demuxer.onMoovStart = this.onMoovStart.bind(this);
      this.demuxer.onReady = this.onReady.bind(this);
      this.demuxer.onError = this.onError.bind(this);
      this.demuxer.appendBuffer(arrayBuffer);
    } catch (error) {
      console.error('Error fetching and parsing MP4 file:', error);
    }
  }

  onMoovStart(info) {
    // Placeholder for the onMoovStart callback in case we need it
  }

  onReady(info) {
    const videoTrack = info.tracks.find((track) => track.type === 'video');
    const trak = this.demuxer.getTrackById(videoTrack.id);
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
    this.demuxer.setExtractionOptions(videoTrack.id);
    this.demuxer.start();
    this.demuxer.onSamples = (id, user, samples) => {
      const frames = samples.map((sample, index) => {
        if (sample.is_sync) {
          this.keyframeIndex.push(this.currentFrame);
        }
        this.currentFrame++;
        return new EncodedVideoChunk({
          type: sample.is_sync ? 'key' : 'delta',
          timestamp: sample.dts,
          duration: sample.duration,
          data: sample.data,
        });
      });
      this.onChunk({ frames, description: this.getDescription(trak) });
    };
    this.demuxer.flush();
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
    console.error('Demuxer error:', error);
  }

  seekToFrame(frameNumber) {
    if (!this.info) return;
    const targetTime = (frameNumber / this.totalFrames) * this.info.duration;
    this.demuxer.seek(targetTime);
    this.currentFrame = frameNumber;
    this.onSeek(frameNumber);
  }

  stop() {
    if (this.demuxer) {
      this.demuxer.stop();
      this.demuxer = null;
    }
  }
}

let demuxer;

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
  demuxer = new MP4Demuxer(
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
  demuxer.start();
}

function seekToFrame(frameNumber) {
  if (demuxer) {
    demuxer.seekToFrame(frameNumber);
  }
}