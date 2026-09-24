/** Curated "learn this gap" links + referral helpers. Pure ASCII, client-safe. */

const LEARN_MAP: Record<string, { label: string; url: string }> = {
  python: { label: "Python tutorial (official docs)", url: "https://docs.python.org/3/tutorial/" },
  javascript: { label: "JavaScript guide (MDN)", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide" },
  typescript: { label: "TypeScript handbook", url: "https://www.typescriptlang.org/docs/handbook/intro.html" },
  react: { label: "Learn React (official)", url: "https://react.dev/learn" },
  "next.js": { label: "Next.js docs", url: "https://nextjs.org/docs" },
  nextjs: { label: "Next.js docs", url: "https://nextjs.org/docs" },
  node: { label: "Node.js docs", url: "https://nodejs.org/en/docs" },
  "node.js": { label: "Node.js docs", url: "https://nodejs.org/en/docs" },
  sql: { label: "SQLBolt (interactive)", url: "https://sqlbolt.com/" },
  postgres: { label: "PostgreSQL docs", url: "https://www.postgresql.org/docs/" },
  mysql: { label: "MySQL tutorial", url: "https://dev.mysql.com/doc/mysql-getting-started/en/" },
  mongodb: { label: "MongoDB docs", url: "https://www.mongodb.com/docs/" },
  docker: { label: "Docker get started", url: "https://docs.docker.com/get-started/" },
  kubernetes: { label: "Kubernetes basics", url: "https://kubernetes.io/docs/tutorials/kubernetes-basics/" },
  aws: { label: "AWS Skill Builder (free tier)", url: "https://skillbuilder.aws/" },
  git: { label: "Git docs", url: "https://git-scm.com/doc" },
  html: { label: "HTML guide (MDN)", url: "https://developer.mozilla.org/en-US/docs/Web/HTML" },
  css: { label: "CSS guide (MDN)", url: "https://developer.mozilla.org/en-US/docs/Web/CSS" },
  tailwind: { label: "Tailwind docs", url: "https://tailwindcss.com/docs" },
  django: { label: "Django docs", url: "https://docs.djangoproject.com/" },
  flask: { label: "Flask tutorial", url: "https://flask.palletsprojects.com/tutorial/" },
  fastapi: { label: "FastAPI tutorial", url: "https://fastapi.tiangolo.com/tutorial/" },
  java: { label: "Learn Java (dev.java)", url: "https://dev.java/learn/" },
  "c++": { label: "LearnCpp.com", url: "https://www.learncpp.com/" },
  go: { label: "Go tour", url: "https://go.dev/tour/" },
  rust: { label: "The Rust Book", url: "https://doc.rust-lang.org/book/" },
  pandas: { label: "Pandas docs", url: "https://pandas.pydata.org/docs/getting_started/" },
  "machine learning": { label: "ML crash course (Google)", url: "https://developers.google.com/machine-learning/crash-course" },
  ml: { label: "ML crash course (Google)", url: "https://developers.google.com/machine-learning/crash-course" },
  tensorflow: { label: "TensorFlow learn", url: "https://www.tensorflow.org/learn" },
  pytorch: { label: "PyTorch tutorials", url: "https://pytorch.org/tutorials/" },
  excel: { label: "Excel help (Microsoft)", url: "https://support.microsoft.com/excel" },
  "power bi": { label: "Power BI docs", url: "https://learn.microsoft.com/power-bi/" },
  figma: { label: "Figma help", url: "https://help.figma.com/" },
  linux: { label: "Linux Journey", url: "https://linuxjourney.com/" },
  rest: { label: "REST API tutorial", url: "https://restfulapi.net/" },
  graphql: { label: "GraphQL learn", url: "https://graphql.org/learn/" },
  testing: { label: "Jest docs", url: "https://jestjs.io/docs/getting-started" },
  jest: { label: "Jest docs", url: "https://jestjs.io/docs/getting-started" },
  vue: { label: "Vue docs", url: "https://vuejs.org/guide/" },
  angular: { label: "Angular tutorials", url: "https://angular.dev/tutorials" },
  firebase: { label: "Firebase docs", url: "https://firebase.google.com/docs" },
};

/** Best link for a skill gap; falls back to a guided web search. */
export function learnLink(skill: string): { label: string; url: string } {
  const hit = LEARN_MAP[skill.toLowerCase().trim()];
  if (hit) return hit;
  return {
    label: `Search beginner tutorials for ${skill}`,
    url: `https://www.google.com/search?q=${encodeURIComponent(`learn ${skill} tutorial beginners`)}`,
  };
}

/** LinkedIn people search for a company — filter by your college, ask for a referral. */
export function linkedinPeopleUrl(company: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(company)}`;
}

/** LinkedIn company search (never 404s unlike guessed slugs). */
export function linkedinCompanyUrl(company: string): string {
  return `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(company)}`;
}
