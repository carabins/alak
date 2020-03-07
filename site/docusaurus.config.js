module.exports = {
  title: 'Alak Atom',
  tagline: 'базовая частица реактивности',
  url: 'https://alak.now.sh',
  baseUrl: '/',
  favicon: '/favicon.ico',
  organizationName: 'carabins/alak', // Usually your GitHub org/user name.
  projectName: 'alak', // Usually your repo name.
  themeConfig: {
    navbar: {
      title: 'Atom',
      logo: {
        alt: 'Alak Logo',
        src: 'img/logo.svg',
      },
      links: [
        //{ to: 'docs/start', label: 'Docs', position: 'left' },
        { to: 'docs/api/index', label: 'API', position: 'left' },
        //{ to: 'blog', label: 'Blog', position: 'left' },
        {
          href: 'https://github.com/carabins/alak',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },

    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Начало',
              to: 'docs/start',
            }
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Telegram',
              href: 'http://gleb.pw/',
            }
            //{
            //  label: 'Discord',
            //  href: 'https://discordapp.com/invite/docusaurus',
            //},
          ],
        },
        {
          title: 'Social',
          items: [
            //{
            //  label: 'Blog',
            //  to: 'blog',
            //},
            {
              label: 'GitHub',
              href: 'https://github.com/carabins/alak',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/glebyp',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Alak Reactive Atom - Open Source.`,
    },
  },
  scripts: [
    //"/alak.js",
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.52.0/codemirror.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.52.0/mode/javascript/javascript.min.js",
    "https://unpkg.com/jshint@2.9.6/dist/jshint.js",
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.52.0/addon/lint/lint.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.52.0/addon/lint/javascript-lint.min.js",
  ],
  themes: ['@docusaurus/theme-live-codeblock'],
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
}
