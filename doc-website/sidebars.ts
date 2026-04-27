import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'introduction',
    {
      type: 'category',
      label: 'Architecture',
      collapsed: false,
      items: [
        'system-architecture',
        'sourcing-layer',
        'core-protocol-layer',
        'risk-market-layer',
        'integrity-layer',
        'surface-layer',
      ],
    },
    {
      type: 'category',
      label: 'Financial Model',
      collapsed: false,
      items: [
        'financial-model',
        'token-model',
        'market-design',
        'edge-case-handling',
      ],
    },
    {
      type: 'category',
      label: 'Protocol Operations',
      collapsed: false,
      items: [
        'core-operations',
        'security-controls',
        'compliance-posture',
      ],
    },
    {
      type: 'category',
      label: 'Project',
      collapsed: true,
      items: [
        'roadmap',
        'faq',
        'glossary',
      ],
    },
  ],
};

export default sidebars;
