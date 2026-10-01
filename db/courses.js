// The starting catalogue, created only on an empty database (see db/seed.js).
// After that, tutors own the content and edit it in the LMS.

const lesson = (title, body, minutes = 12) => ({
  title,
  minutes,
  body: `## ${title}\n\n${body}\n\n- Follow along in your editor.\n- Commit your work to GitHub at the end.\n`,
});

const courses = [
  {
    slug: 'full-stack-web-development',
    title: 'Full-Stack Web Development',
    area: 'Web Development',
    tier: 'Bootcamp',
    description: 'Master HTML, CSS, JS, React, Node.js and SQL. Build full applications from scratch and deploy them.',
    durationText: '6 months',
    modules: [
      {
        title: 'Web foundations',
        lessons: [
          lesson('How the web works', 'Clients, servers, HTTP requests and responses. What happens when you type a URL.'),
          {
            ...lesson('Semantic HTML & accessibility', 'Document structure, landmarks, headings, forms and labels. Why semantics matter for screen readers.'),
            resources: [{ title: 'Intro walkthrough', url: 'https://youtu.be/dQw4w9WgXcQ', kind: 'VIDEO' }],
          },
          lesson('Your first web page', 'Set up VS Code, create index.html, preview with Live Server.'),
        ],
      },
      {
        title: 'Styling with CSS',
        lessons: [
          lesson('The box model', 'Margin, border, padding, content. Block vs inline. box-sizing.'),
          lesson('Flexbox', 'Main axis, cross axis, justify-content, align-items, gap. Building a nav bar.'),
          lesson('CSS Grid', 'Grid template columns and rows, areas, responsive layouts.'),
          lesson('Responsive design with Tailwind', 'Utility classes, breakpoints, mobile-first workflow.'),
        ],
      },
      {
        title: 'JavaScript for the web',
        lessons: [
          lesson('Values, variables and functions', 'let/const, types, function declarations and arrow functions.'),
          lesson('The DOM and events', 'querySelector, textContent, addEventListener, event objects.'),
          lesson('Async and fetch', 'Promises, async/await, calling a JSON API and rendering the result.'),
        ],
      },
      {
        title: 'Front end with React',
        lessons: [
          lesson('Components and props', 'JSX, function components, passing and using props.'),
          lesson('State and hooks', 'useState, useEffect, rules of hooks.'),
          lesson('Forms and calling APIs', 'Controlled inputs, submitting data, loading and error states.'),
        ],
      },
      {
        title: 'Back end with Node',
        lessons: [
          lesson('HTTP with Express', 'Routes, request and response, middleware, JSON bodies.'),
          lesson('Designing a REST API', 'Resources, verbs, status codes, validation with Zod.'),
          lesson('Auth with JWT', 'Hashing passwords, issuing tokens, protecting routes.'),
        ],
      },
      {
        title: 'Databases',
        lessons: [
          lesson('Relational modelling and SQL', 'Tables, keys, relationships, SELECT / INSERT / UPDATE.'),
          lesson('PostgreSQL and an ORM', 'Connecting, migrations, queries with Prisma.'),
        ],
      },
      {
        title: 'Capstone & career',
        lessons: [
          lesson('Plan your capstone', 'Scope, wireframes, data model, milestones.'),
          lesson('Polish and deploy', 'Environment variables, deploying front end and back end, custom domain.'),
          lesson('GitHub, CV and interviews', 'README, pinned repos, talking about your project.'),
        ],
      },
    ],
  },
  {
    slug: 'ui-ux-product-design',
    title: 'UI/UX Product Design',
    area: 'Design',
    tier: 'Bootcamp',
    description: 'Learn user research, wireframing, Figma prototyping and design systems for real-world products.',
    durationText: '5 months',
    modules: [
      {
        title: 'Foundations of UX',
        lessons: [
          lesson('The design process', 'Discover, define, design, deliver. Where research fits.'),
          lesson('Users and needs', 'Jobs-to-be-done, pain points, opportunity framing.'),
        ],
      },
      {
        title: 'Research',
        lessons: [
          lesson('Interviews', 'Writing a guide, avoiding leading questions, note-taking.'),
          lesson('Personas and journey maps', 'Synthesising findings into shareable artefacts.'),
        ],
      },
      {
        title: 'Interaction and visual design',
        lessons: [
          lesson('Wireframing', 'Low-fidelity flows, information hierarchy, content-first.'),
          lesson('Layout, type and colour', 'Grids, scale, contrast, accessible palettes.'),
          lesson('Components in Figma', 'Auto layout, variants, constraints.'),
        ],
      },
      {
        title: 'Prototyping, testing and handoff',
        lessons: [
          lesson('Interactive prototypes', 'Linking frames, overlays, smart animate.'),
          lesson('Usability testing', 'Task-based sessions, severity ratings, iterating.'),
          lesson('Design systems and handoff', 'Tokens, documentation, working with developers.'),
        ],
      },
      {
        title: 'Capstone',
        lessons: [lesson('End-to-end case study', 'Research through tested prototype, told as a portfolio story.')],
      },
    ],
  },
  {
    slug: 'python-programming',
    title: 'Python Programming',
    area: 'Foundations',
    tier: 'Foundation',
    description: 'Start your coding journey with Python. Learn core programming concepts and build interactive scripts.',
    durationText: '8 weeks',
    modules: [
      {
        title: 'Getting started',
        lessons: [
          lesson('Install Python & VS Code', 'Interpreter, extensions, running a file.'),
          lesson('Variables and types', 'Strings, numbers, booleans, f-strings.'),
        ],
      },
      {
        title: 'Logic and flow',
        lessons: [
          lesson('Conditionals', 'if / elif / else, comparison and boolean operators.'),
          lesson('Loops', 'for, while, range, break and continue.'),
          lesson('Functions', 'Parameters, return values, scope.'),
        ],
      },
      {
        title: 'Data and files',
        lessons: [
          lesson('Lists and dictionaries', 'Indexing, methods, iteration, comprehensions.'),
          lesson('Files and JSON', 'Reading and writing files, parsing JSON.'),
          lesson('Calling an API with requests', 'GET requests, status codes, handling errors.'),
        ],
      },
      {
        title: 'Capstone',
        lessons: [lesson('Build a command-line tool', 'Plan, build, document and push a small CLI project.')],
      },
    ],
  },
  {
    slug: 'javascript-programming',
    title: 'JavaScript Programming',
    area: 'Foundations',
    tier: 'Foundation',
    description: 'Learn the language of the web. The perfect starting point before diving into React or Node.js.',
    durationText: '8 weeks',
    modules: [
      {
        title: 'Fundamentals',
        lessons: [
          lesson('Values and variables', 'let/const, types, template literals.'),
          lesson('Functions', 'Declarations, expressions, arrow functions, callbacks.'),
        ],
      },
      {
        title: 'The browser',
        lessons: [
          lesson('Selecting and changing elements', 'querySelector, classList, textContent.'),
          lesson('Events', 'Listeners, the event object, delegation.'),
        ],
      },
      {
        title: 'Modern & async JavaScript',
        lessons: [
          lesson('Array methods', 'map, filter, reduce, find.'),
          lesson('Promises and async/await', 'Chaining, error handling, fetch.'),
        ],
      },
      {
        title: 'Capstone',
        lessons: [lesson('Interactive single-page app', 'State, rendering lists, working with an API, deploy.')],
      },
    ],
  },
  {
    slug: 'intro-to-ai-and-ai-agents',
    title: 'Intro to AI + AI Agents (No-Code)',
    area: 'AI',
    tier: 'Short Course',
    description: 'Learn how to automate workflows and build custom AI assistants without writing a single line of code.',
    durationText: '3–4 weeks',
    modules: [
      {
        title: 'How modern AI works',
        lessons: [
          lesson('Models, LLMs and tokens', 'What a large language model is, what it can and cannot do.'),
          lesson('Risks, bias and ethics', 'Hallucinations, privacy, responsible use at work.'),
        ],
      },
      {
        title: 'Prompting and automation',
        lessons: [
          lesson('Prompting well', 'Context, structure, examples, evaluating outputs.'),
          lesson('Your first no-code agent', 'Triggers and actions, connecting apps, testing a workflow.'),
        ],
      },
      {
        title: 'Mini-project',
        lessons: [lesson('Automate a real task', 'Pick a task from your work or studies and ship an agent for it.')],
      },
    ],
  },
];

module.exports = { courses };
