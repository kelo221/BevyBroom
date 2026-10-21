import packageMetadata from './package.json';

/**
 * Electrobun 2.x build configuration. Its type lives in the Hutch devkit
 * (`.hutch/devkit/api/config/ElectrobunConfig.ts`), which type checks cannot
 * rely on; Hutch validates this object when it builds.
 */
const electrobunConfig = {
  app: {
    name: 'BevyBroom',
    identifier: 'com.henry00is.bevybroom',
    version: packageMetadata.version,
    description: 'Three.js 3D world editor for game level design.',
  },
  build: {
    mainProcess: 'bun',
    bun: {
      entrypoint: 'src/desktop/bun/index.ts',
      alias: { '@': './src' },
    },
    copy: {
      desktop_view_dist: 'views/main_ui',
      'public/favicon.ico': 'views/main_ui/favicon.ico',
      'public/favicon-16x16.png': 'views/main_ui/favicon-16x16.png',
      'public/favicon-32x32.png': 'views/main_ui/favicon-32x32.png',
      'public/apple-touch-icon.png': 'views/main_ui/apple-touch-icon.png',
      'public/android-chrome-192x192.png': 'views/main_ui/android-chrome-192x192.png',
      'public/android-chrome-512x512.png': 'views/main_ui/android-chrome-512x512.png',
    },
    buildFolder: 'desktop_build',
    artifactFolder: 'desktop_artifacts',
    win: {
      defaultRenderer: 'native',
      bundleCEF: false,
      icon: 'public/app_icon.ico',
    },
    mac: {
      defaultRenderer: 'native',
      bundleCEF: false,
      createDmg: false,
      icons: 'public/app_icon.iconset',
    },
    linux: {
      defaultRenderer: 'native',
      bundleCEF: false,
      icon: 'public/android-chrome-512x512.png',
    },
  },
  runtime: {
    exitOnLastWindowClosed: true,
  },
  scripts: {
    preBuild: 'scripts/desktop_view_build.ts',
  },
  release: {
    baseUrl: 'https://github.com/Henry00IS/AiWorldEd/releases/latest/download',
    generatePatch: false,
  },
};

export default electrobunConfig;
