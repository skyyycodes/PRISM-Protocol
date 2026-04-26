import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/">
            Read the Documentation
          </Link>
        </div>
      </div>
    </header>
  );
}

function FeatureCard({title, description}: {title: string; description: string}) {
  return (
    <div className="col col--4">
      <div className="padding-vert--md padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Documentation"
      description="PRISM Protocol official documentation for programmable on-chain credit risk.">
      <HomepageHeader />
      <main>
        <section className="padding-vert--xl">
          <div className="container">
            <div className="row">
              <FeatureCard
                title="Risk-Segmented Credit"
                description="PRISM means Programmable Risk & Income Structured Markets: every vault separates credit into Senior, Mezzanine, and Equity tranches."
              />
              <FeatureCard
                title="Deterministic Waterfalls"
                description="Yield flows top-down to seniority. Losses flow bottom-up through subordination. The protocol makes credit behavior explicit and reproducible on-chain."
              />
              <FeatureCard
                title="Liquid Credit Markets"
                description="Fungible tranche tokens trade against USDC on AMM pools, allowing market prices to diverge from NAV and reveal live risk perception."
              />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
