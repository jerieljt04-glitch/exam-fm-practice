"use client";

import React, { useMemo } from "react";
import { Film, FileText } from "lucide-react";

interface VideoPlayerProps {
  /** Empty when no walkthrough has been recorded for this template. */
  videoUrl: string;
  title?: string;
}

const EMBED_HOSTS = ["youtube.com", "youtube-nocookie.com", "youtu.be", "vimeo.com", "player.vimeo.com", "stream.mux.com"];
const FILE_EXTENSIONS = [".mp4", ".webm", ".ogg", ".ogv", ".mov"];

type PlaybackMode = "none" | "embed" | "file";

function classifyUrl(url: string): PlaybackMode {
  const trimmed = url.trim();
  if (!trimmed) return "none";

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "none";
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "none";

  const path = parsed.pathname.toLowerCase();
  if (FILE_EXTENSIONS.some((extension) => path.endsWith(extension))) return "file";
  if (EMBED_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
    return "embed";
  }
  return "embed";
}

/**
 * Solution walkthrough player.
 *
 * Renders a native `<video>` element for direct media files and an iframe for
 * recognised embed hosts. When no video is configured for a template it says so
 * plainly rather than showing a player that cannot play anything — the written
 * KaTeX derivation above it is always the complete solution.
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  title = "Solution walkthrough",
}) => {
  const mode = useMemo(() => classifyUrl(videoUrl), [videoUrl]);

  if (mode === "none") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-dashed bg-muted/40 p-5 text-sm text-muted-foreground">
        <FileText className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-foreground">No video walkthrough for this question yet</p>
          <p className="mt-1 leading-relaxed">
            The full step-by-step derivation above covers every stage of the solution. Video
            walkthroughs appear here once a library is configured through{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              NEXT_PUBLIC_SOLUTION_VIDEO_BASE_URL
            </code>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950/70 px-4 py-2.5">
        <Film className="h-4 w-4 text-blue-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">{title}</span>
      </div>

      <div className="aspect-video w-full bg-black">
        {mode === "file" ? (
          <video
            key={videoUrl}
            className="h-full w-full"
            controls
            preload="metadata"
            controlsList="nodownload"
          >
            <source src={videoUrl} />
            Your browser cannot play this video. The written derivation above contains the full
            solution.
          </video>
        ) : (
          <iframe
            key={videoUrl}
            src={videoUrl}
            title={title}
            className="h-full w-full border-0"
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;
