const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

function probe(file) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(file, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

function run(cmdBuilder) {
  return new Promise((resolve, reject) => {
    const cmd = cmdBuilder(ffmpeg());
    cmd.on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

module.exports = { ffmpeg, probe, run, ffmpegPath, ffprobePath };
