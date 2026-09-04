module.exports = {
  ci: {
    collect: {
      staticDistDir: '.',
      numberOfRuns: 1,
      settings: { preset: 'desktop' }
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.6 }],
        'categories:accessibility': ['error', { minScore: 0.85 }],
        'categories:best-practices': ['warn', { minScore: 0.7 }],
        'categories:seo': ['warn', { minScore: 0.8 }]
      }
    },
    upload: { target: 'temporary-public-storage' }
  }
};
