import { Clock3, Play, ShieldCheck } from 'lucide-react';

const videos = [
  {
    title: 'Private by default. Built for speed.',
    description: 'A 15-second ZKAS speed and privacy comparison with Zcash and Monero.',
    duration: '15 sec',
    src: '/videos/zkas-private-speed-comparison-15s.mp4',
    poster: '/videos/zkas-private-speed-comparison-poster.jpg',
  },
];

export function VideosPage() {
  return (
    <section className="video-library" aria-labelledby="video-library-title">
      <div className="video-library-head">
        <div>
          <span className="eyebrow"><Play size={14} /> ZKAS VIDEO LIBRARY</span>
          <h2 id="video-library-title">Watch ZKAS in motion</h2>
          <p>Short videos about ZKAS speed, privacy and the network. New releases will be added here.</p>
        </div>
        <span className="video-count">{videos.length} VIDEO</span>
      </div>

      <div className="video-gallery">
        {videos.map((video) => (
          <article className="video-card" key={video.src}>
            <div className="video-frame">
              <video controls playsInline preload="metadata" poster={video.poster}>
                <source src={video.src} type="video/mp4" />
                Your browser does not support MP4 video playback.
              </video>
            </div>
            <div className="video-card-copy">
              <div className="video-card-meta"><span>FEATURED</span><span><Clock3 size={14} /> {video.duration}</span></div>
              <h3>{video.title}</h3>
              <p>{video.description}</p>
              <div className="video-privacy-note"><ShieldCheck size={15} /> No autoplay. Press play when you are ready.</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
