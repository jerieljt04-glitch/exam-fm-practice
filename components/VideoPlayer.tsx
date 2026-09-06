"use client";

import React, { useState } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Maximize, Film } from "lucide-react";

interface VideoPlayerProps {
  videoUrl: string;
  title?: string;
  solutionKeyPoints?: string[];
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  title = "Video Solution Walkthrough",
  solutionKeyPoints = [
    "Identify known cash flow timing and discounting frequency",
    "Set up prospective vs retrospective equation of value",
    "Apply correct actuarial notation & compound interest factors",
    "Verify sensitivity and bounds against common distractors",
  ],
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [progress, setProgress] = useState(35);

  const isEmbed = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be") || videoUrl.includes("vimeo.com");

  return (
    <div className="bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-800 text-white">
      {/* Top player bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">{title}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/50 font-mono">
            SOA FM • 1080p HD
          </span>
        </div>
      </div>

      {/* Video Content Area */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center">
        {isEmbed ? (
          <iframe
            src={videoUrl}
            title={title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="relative w-full h-full bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-6 text-center">
            {/* Visual Actuarial Animation / Solution Canvas */}
            <div className="w-16 h-16 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center mb-4 group cursor-pointer hover:scale-105 transition-transform"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 text-blue-400" />
              ) : (
                <Play className="w-8 h-8 text-blue-400 fill-blue-400 translate-x-0.5" />
              )}
            </div>

            <h4 className="text-sm font-semibold text-slate-200 mb-1">
              Step-by-Step Actuarial Solution Stream
            </h4>
            <p className="text-xs text-slate-400 max-w-md">
              Full chalkboard walkthrough deriving each step, analyzing distractor traps, and verifying BA II Plus calculator keystrokes.
            </p>

            {/* Live Interactive Timeline */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
              {/* Scrubber */}
              <div className="w-full bg-slate-700/60 h-1.5 rounded-full mb-2 cursor-pointer overflow-hidden relative">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="hover:text-white transition-colors"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>
                  <button
                    onClick={() => setProgress(0)}
                    className="hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="hover:text-white transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <span className="font-mono text-[11px] text-slate-400">01:45 / 04:15</span>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                    className="bg-slate-800 border border-slate-700 text-xs rounded px-1.5 py-0.5 text-slate-300 focus:outline-none"
                  >
                    <option value={1}>1.0x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2.0x</option>
                  </select>
                  <button className="hover:text-white transition-colors">
                    <Maximize className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Video Solution Key Takeaways */}
      <div className="p-4 bg-slate-950/60 border-t border-slate-800">
        <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Key Actuarial Concepts Covered in This Video:
        </h5>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300">
          {solutionKeyPoints.map((point, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
