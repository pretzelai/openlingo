import { Link } from "react-router-dom";
import { Feedback } from "../components/Feedback";
import { api } from "../lib/api";
import { useAsync } from "../lib/useAsync";

export function LandingPage() {
  const { data: sessionData } = useAsync(() => api.session(), []);
  const { data: starsData } = useAsync(() => api.stars(), []);
  const stars = starsData?.stars;

  return (
    <div className="landing">
      <section className="hero-card">
        <h1>OpenLingo</h1>
        <p className="subtitle">Connecting LLMs to language learning</p>
        <p className="muted">Create personalised units, read/listen to translated articles and practice with AI.</p>
        <div className="cta-row">
          {sessionData?.session ? (
            <Link to="/units" className="button primary large">Go to App</Link>
          ) : (
            <>
              <Link to="/sign-up" className="button primary large">Get Started</Link>
              <Link to="/sign-in" className="button outline large">I Already Have an Account</Link>
            </>
          )}
        </div>
        <a className="github-pill" href="https://github.com/pretzelai/openlingo" target="_blank" rel="noreferrer">
          GitHub {typeof stars === "number" ? `★ ${stars.toLocaleString()}` : ""}
        </a>
        <Feedback />
        <div className="video-card">
          <h2>See it in action</h2>
          <iframe src="https://www.youtube.com/embed/YEYLhulhFUc" title="OpenLingo Demo" allowFullScreen />
        </div>
      </section>
    </div>
  );
}
