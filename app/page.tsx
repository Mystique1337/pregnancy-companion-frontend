import HeroIllustration from "./_components/HeroIllustration";
import VideoEmbed from "./_components/VideoEmbed";
import ScrollReveal from "./_components/ScrollReveal";
import BumplyChat from "./_components/BumplyChat";
import RegisterForm from "./_components/RegisterForm";
import LanguageSwitcher from "./_components/LanguageSwitcher";
import { DEV_STAGES } from "@/lib/babyImages";
import { getUiLang } from "@/lib/serverLang";
import { t } from "@/lib/i18n";

export default async function Home() {
  const L = await getUiLang();
  return (
    <>
      <nav>
        <div className="nav-inner">
          <div className="logo">
            <div className="logo-dot" />
            Bumply
          </div>
          <ul className="nav-links">
            <li><a href="#how">{t("home.nav.how", L)}</a></li>
            <li><a href="#features">{t("home.nav.features", L)}</a></li>
            <li><a href="#stories">{t("home.nav.stories", L)}</a></li>
            <li><a href="/login">{t("home.nav.signin", L)}</a></li>
          </ul>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LanguageSwitcher lang={L} compact />
            <a href="#register" className="nav-cta">{t("home.nav.start", L)}</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero" id="home">
        <div className="hero-bg">
          <div className="hero-orb orb1" />
          <div className="hero-orb orb2" />
          <div className="hero-orb orb3" />
        </div>
        <div className="hero-inner">
          <div>
            <div className="hero-eyebrow"><div className="eyebrow-dot" />{t("home.hero.eyebrow", L)}</div>
            <h1 className="hero-h">
              {t("home.hero.l1", L)}<br />
              <em>{t("home.hero.l2", L)}</em><br />
              <span className="lav">{t("home.hero.l3", L)}</span>
            </h1>
            <p className="hero-p">{t("home.hero.p", L)}</p>
            <div className="hero-btns">
              <a className="btn-pink" href="#register">{t("home.hero.cta1", L)}</a>
              <a className="btn-ghost" href="#how">{t("home.hero.cta2", L)}</a>
              <a className="btn-ghost" href="/demo">{t("home.hero.cta3", L)}</a>
            </div>
            <div className="hero-trust">
              <div className="trust-item"><div className="trust-icon">🌸</div><div className="trust-text">{t("home.hero.t1", L)}</div></div>
              <div className="trust-item"><div className="trust-icon">🥗</div><div className="trust-text">{t("home.hero.t2", L)}</div></div>
              <div className="trust-item"><div className="trust-icon">💌</div><div className="trust-text">{t("home.hero.t3", L)}</div></div>
            </div>
          </div>

          <div className="hero-right">
            <div className="float-pill fp-weight">
              <div className="pill-label">{t("home.pill.weight", L)}</div>
              <div className="pill-val">14g 🌱</div>
            </div>
            <div className="float-pill fp-size">
              <div className="pill-label">{t("home.pill.size", L)}</div>
              <div className="pill-val">🍋</div>
            </div>
            <HeroIllustration />
            <div className="float-pill fp-week">
              <div className="pill-label">{t("home.pill.youarein", L)}</div>
              <div className="pill-big">12</div>
              <div className="pill-sub">{t("home.pill.weeks", L)}</div>
            </div>
            <div className="float-pill fp-sent">
              <div className="pill-label">{t("home.pill.update", L)}</div>
              <div className="pill-val">{t("home.pill.sent", L)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how">
        <div className="wrap">
          <div className="how-header reveal">
            <p className="s-label">{t("home.nav.how", L)}</p>
            <h2 className="s-title">{t("home.how.title", L)}</h2>
            <p className="s-sub">{t("home.how.sub", L)}</p>
          </div>
          <VideoEmbed />
          <div className="steps-grid reveal">
            <div className="step-card">
              <div className="step-num">01</div>
              <div className="step-title">{t("home.step1.title", L)}</div>
              <div className="step-desc">{t("home.step1.desc", L)}</div>
            </div>
            <div className="step-card">
              <div className="step-num">02</div>
              <div className="step-title">{t("home.step2.title", L)}</div>
              <div className="step-desc">{t("home.step2.desc", L)}</div>
            </div>
            <div className="step-card">
              <div className="step-num">03</div>
              <div className="step-title">{t("home.step3.title", L)}</div>
              <div className="step-desc">{t("home.step3.desc", L)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features">
        <div className="wrap">
          <div className="reveal">
            <p className="s-label">{t("home.features.label", L)}</p>
            <h2 className="s-title">{t("home.features.title", L)}</h2>
          </div>
          <div className="features-grid reveal">
            <div className="feat-card fc-pink">
              <div className="feat-icon">👶</div>
              <div className="feat-title">{t("home.feat1.title", L)}</div>
              <div className="feat-desc">{t("home.feat1.desc", L)}</div>
              <span className="feat-tag">{t("home.feat1.tag", L)}</span>
            </div>
            <div className="feat-card fc-lav">
              <div className="feat-icon">🥗</div>
              <div className="feat-title">{t("home.feat2.title", L)}</div>
              <div className="feat-desc">{t("home.feat2.desc", L)}</div>
              <span className="feat-tag">{t("home.feat2.tag", L)}</span>
            </div>
            <div className="feat-card fc-blue">
              <div className="feat-icon">💌</div>
              <div className="feat-title">{t("home.feat3.title", L)}</div>
              <div className="feat-desc">{t("home.feat3.desc", L)}</div>
              <span className="feat-tag">{t("home.feat3.tag", L)}</span>
            </div>
            <div className="feat-card fc-gold">
              <div className="feat-icon">🎯</div>
              <div className="feat-title">{t("home.feat4.title", L)}</div>
              <div className="feat-desc">{t("home.feat4.desc", L)}</div>
              <span className="feat-tag">{t("home.feat4.tag", L)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* WATCH BABY GROW */}
      <section id="grow">
        <div className="wrap">
          <div className="how-header reveal">
            <p className="s-label">{t("home.grow.label", L)}</p>
            <h2 className="s-title">{t("home.grow.title", L)}</h2>
            <p className="s-sub">{t("home.grow.sub", L)}</p>
          </div>
          <div className="grow-grid reveal">
            {DEV_STAGES.map((s) => (
              <figure className="grow-card" key={s.file}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/baby/${s.file}`} alt={s.caption} loading="lazy" />
                <figcaption>
                  <span className="grow-week">{s.label}</span>
                  <span className="grow-cap">{s.caption}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* REGISTER */}
      <section id="register">
        <div className="wrap">
          <div className="register-layout">
            <div className="reveal">
              <p className="s-label">{t("home.reg.label", L)}</p>
              <h2 className="reg-side-title">{t("dash.journey", L)}</h2>
              <p className="reg-side-p">{t("home.reg.p", L)}</p>
              <div className="promise-list">
                <div className="promise-row">
                  <div className="p-icon pink">🌸</div>
                  <div><div className="p-name">{t("home.promise1.name", L)}</div><div className="p-desc">{t("home.promise1.desc", L)}</div></div>
                </div>
                <div className="promise-row">
                  <div className="p-icon lav">🔒</div>
                  <div><div className="p-name">{t("home.promise2.name", L)}</div><div className="p-desc">{t("home.promise2.desc", L)}</div></div>
                </div>
                <div className="promise-row">
                  <div className="p-icon blue">💙</div>
                  <div><div className="p-name">{t("home.promise3.name", L)}</div><div className="p-desc">{t("home.promise3.desc", L)}</div></div>
                </div>
              </div>
            </div>
            <div className="reveal d2">
              <RegisterForm />
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="stories">
        <div className="wrap">
          <div className="reveal">
            <p className="s-label">{t("home.stories.label", L)}</p>
            <h2 className="s-title">{t("home.stories.title", L)}</h2>
          </div>
          <div className="testi-grid reveal">
            <div className="testi-card">
              <div className="testi-stars">★★★★★</div>
              <div className="testi-text">{t("home.testi1", L)}</div>
              <div className="testi-author"><div className="testi-avatar av1">👩🏾</div><div><div className="testi-name">Chiamaka O.</div><div className="testi-week">Week 28 · Lagos</div></div></div>
            </div>
            <div className="testi-card">
              <div className="testi-stars">★★★★★</div>
              <div className="testi-text">{t("home.testi2", L)}</div>
              <div className="testi-author"><div className="testi-avatar av2">👩🏽</div><div><div className="testi-name">Fatima A.</div><div className="testi-week">Week 19 · Abuja</div></div></div>
            </div>
            <div className="testi-card">
              <div className="testi-stars">★★★★★</div>
              <div className="testi-text">{t("home.testi3", L)}</div>
              <div className="testi-author"><div className="testi-avatar av3">👩🏿</div><div><div className="testi-name">Blessing N.</div><div className="testi-week">Week 11 · Port Harcourt</div></div></div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <div className="foot-logo">Bumply <span>{t("home.foot.companion", L)}</span></div>
              <p className="foot-desc">{t("home.foot.desc", L)}</p>
            </div>
            <div>
              <div className="foot-col-title">{t("home.foot.navigate", L)}</div>
              <ul className="foot-links">
                <li><a href="#how">{t("home.nav.how", L)}</a></li>
                <li><a href="#features">{t("home.nav.features", L)}</a></li>
                <li><a href="#stories">{t("home.stories.label", L)}</a></li>
                <li><a href="/login">{t("home.nav.signin", L)}</a></li>
              </ul>
            </div>
            <div>
              <div className="foot-col-title">{t("home.foot.builtby", L)}</div>
              <ul className="foot-links">
                <li><a href="https://thebrandnerve.com" target="_blank">The Brand NERVE</a></li>
                <li><a href="mailto:thebrandnerve@gmail.com">thebrandnerve@gmail.com</a></li>
              </ul>
            </div>
          </div>
          <div className="foot-bottom">
            <div className="foot-copy">{t("home.foot.copy", L)}</div>
            <div className="foot-copy">Powered by Next.js · NVIDIA · Supabase</div>
          </div>
        </div>
      </footer>

      <BumplyChat />
      <ScrollReveal />
    </>
  );
}
