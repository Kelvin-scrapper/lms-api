// Pure helpers over a course tree (course → modules → lessons), shared by the
// learning endpoints.

function lessonIds(course) {
  return course.modules.flatMap((m) => m.lessons.map((l) => l.id));
}

function summarizeProgress(course, completedIds) {
  const ids = lessonIds(course);
  const completed = new Set(completedIds);
  const done = ids.filter((id) => completed.has(id)).length;
  const total = ids.length;
  return {
    completedLessonIds: ids.filter((id) => completed.has(id)),
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

// First lesson not yet completed, or null when the course is finished.
function nextLesson(course, completedIds) {
  const completed = new Set(completedIds);
  for (const m of course.modules) {
    for (const l of m.lessons) {
      if (!completed.has(l.id)) return { lessonId: l.id, lessonTitle: l.title, moduleTitle: m.title };
    }
  }
  return null;
}

module.exports = { lessonIds, summarizeProgress, nextLesson };
