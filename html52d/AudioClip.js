let audioCtx = null;
const audioInterface = new Audio();
const canPlayScores = {
  "probably": 2,
  "maybe": 1,
  "": 0,
};

function sortOptions(lhs, rhs) {
  // Pick the most likely to be compatible, breaking ties by file size
  return (rhs.score - lhs.score) || (rhs.size - lhs.size);
}

export default class AudioClip {
  /**
   * Construct an audio clip.
   *
   * Options can be specified in one of three ways:
   *
   * new AudioClip(string): Loads a clip by URL with default options
   * new AudioClip(string[]): Given a list of URLs, loads a version
   *    of a clip that the current browser is capable of playing.
   * new AudioClip(object): Configures the audio clip based on the
   *    following options:
   *
   *    - source: A string or list of strings of URLs.
   *    - loop: Whether the clip should loop. (default false)
   *    - loopStart: If looped, where the loop starts, in seconds.
   *    - loopEnd: If looped, where the loop ends, in seconds.
   *    - loopStartSamples: If looped, where the loop starts, in samples.
   *    - loopEndSamples: If looped, where the loop ends, in samples.
   *    - gain: Volume adjustment to apply to the clip. (default 1.0)
   *    - stackable: If true, multiple copies of the clip can play at once.
   *        If false, playing the clip will stop the previous playback.
   *        Stackable clips cannot be stopped. (default false)
   */
  constructor(options) {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }

    this._disconnect = this._disconnect.bind(this);
    this._source = null;
    if (typeof(options) == 'object' && !Array.isArray(options)) {
      this._options = options;
    } else {
      this._options = {};
    }

    let urls = [];
    if (Array.isArray(options)) {
      urls = options;
    } else if (typeof(options) == 'string') {
      urls = [options];
    } else if (typeof(options.source) == 'string') {
      urls = [options.source];
    } else if (Array.isArray(options.source)) {
      urls = options.source;
    }
    if (!urls.length) {
      throw new TypeError("invalid source supplied to AudioClip");
    }
    this._bufferPromise = this._getMetadata(urls);

    this._gainNode = new GainNode(audioCtx, { gain: this._options.gain || 1.0 });
    this._gainNode.connect(audioCtx.destination);
  }

  /**
   * A Promise that resolves when the clip has finished loading.
   *
   * Resolves to true if the clip is playable.
   */
  get ready() {
    return this._bufferPromise.then(() => !!this._options.buffer);
  }

  async _getMetadata(urls) {
    const candidates = [];
    if (urls.length > 1) {
      const heads = [];
      for (const url of urls) {
        heads.push(fetch(url, { method: "HEAD" }));
      }
      for (const response of await Promise.all(heads)) {
        if (!response.ok) {
          continue;
        }

        let contentType = response.headers.get("Content-Type");
        if (contentType == "application/octet-stream") {
          // webserver doesn't identify file type, try to guess by extension
          const ext = response.url.split(".").slice(-1)[0];
          if (ext == "wav") {
            contentType = "audio/wav";
          } else if (ext == "mp3") {
            contentType = "audio/mpeg";
          } else if (ext == "ogg") {
            contentType = "audio/ogg; codecs=vorbis";
          } else if (ext == "m4a") {
            contentType = "audio/mp4";
          }
        }

        candidates.push({
          url: response.url,
          size: parseInt(response.headers.get("Content-Length") || "0"),
          score: canPlayScores[audioInterface.canPlayType(contentType)],
        });
      }
    } else {
      // For a single option, just try it
      candidates.push({ url: urls[0] });
    }
    let buffer = null;
    for (const { url } of candidates) {
      try {
        const data = await (await fetch(url)).arrayBuffer();
        buffer = await audioCtx.decodeAudioData(data);
        break;
      } catch (err) {
        console.warn("Cannot use audio clip: " + url, err);
      }
    }
    if (!buffer) {
      return;
    }
    this._options.buffer = buffer;
    if (this._options.loop) {
      if (this._options.loopStartSamples) {
        this._options.loopStart = this._options.loopStartSamples / buffer.sampleRate;
      } else if (!this._options.loopStart) {
        this._options.loopStart = 0;
      }
      if (this._options.loopEndSamples) {
        this._options.loopEnd = this._options.loopEndSamples / buffer.sampleRate;
      }
      if (!this._options.loopEnd) {
        this._options.loopEnd = buffer.duration;
      }
    }
  }

  /**
   * Gain applied to the clip when played.
   */
  get gain() {
    return this._gainNode.gain.value;
  }

  set gain(v) {
    this._gainNode.gain.value = v;
  }

  /**
   * Starts playing the clip. If the clip had previously been paused,
   * resumes playback at that point.
   *
   * @param {number} Pitch adjustment (default 1.0)
   * @param {number} Speed adjustment (default 1.0)
   */
  play(detune = null, playbackRate = null) {
    if (!this._options.buffer) {
      console.warn("Clip not loaded");
      return;
    }
    let options = this._options;
    if (detune || playbackRate) {
      options = Object.assign({}, this._options);
      if (detune) {
        options.detune = detune;
      }
      if (playbackRate) {
        options.playbackRate = playbackRate;
      }
    }
    if (this._lastNode) {
      this._lastNode.stop();
    }
    const node = new AudioBufferSourceNode(audioCtx, options);
    node.connect(this._gainNode);
    node.addEventListener("ended", this._disconnect);
    this._startTime = audioCtx.currentTime;
    if (this._pauseTime) {
      this._startTime -= this._pauseTime;
      node.start(0, this._pauseTime);
    } else {
      node.start();
    }
    if (!this._options.stackable) {
      this._lastNode = node;
    }
  }

  /**
   * Pauses clip playback and stores the current time.
   *
   * Resume playback with play().
   */
  pause() {
    if (this._lastNode) {
      this._pauseTime = audioCtx.currentTime - this._startTime;
      if (this._lastNode.loop) {
        if (this._pauseTime > this._lastNode.loopEnd) {
          const loopLen = this._lastNode.loopEnd - this._lastNode.loopStart;
          const loopPos = this._pauseTime - this._lastNode.loopStart;
          const loopCount = Math.floor(loopPos / loopLen);
          this._pauseTime -= loopCount * loopLen;
        }
      }
      this._lastNode.stop();
    }
  }

  /**
   * Stops clip playback and resets the current time.
   */
  stop() {
    if (this._lastNode) {
      this._pauseTime = 0;
      this._lastNode.stop();
    }
  }

  /**
   * If the clip is currently looping, allow it to play to the end.
   * The clip will stop afterward.
   */
  release() {
    if (this._lastNode) {
      this._lastNode.loop = false;
    }
  }

  _disconnect(event) {
    try {
      event.target.disconnect(this._gainNode);
    } catch (_) {
      // ignore
    }
    if (this._lastNode == event.target) {
      this._pauseTime = 0;
      this._lastNode = null;
    }
  }

  get currentNode() {
    return this._lastNode;
  }
}

AudioClip.globalContext = audioCtx;
