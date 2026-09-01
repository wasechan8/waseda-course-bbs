import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { CoursePage } from './pages/CoursePage'
import { DirectoryPage } from './pages/DirectoryPage'
import { FacultyPage } from './pages/FacultyPage'
import { GuidePage } from './pages/GuidePage'
import { EntrancePage } from './pages/EntrancePage'
import { LoungePage, LoungeThreadPage } from './pages/LoungePage'
import { AdminPage } from './pages/AdminPage'
import { SavedCoursesPage } from './pages/SavedCoursesPage'

export default function App() {
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<EntrancePage />} />
          <Route path="/boards" element={<DirectoryPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/saved" element={<SavedCoursesPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/faculty/:facultySlug" element={<FacultyPage />} />
          <Route path="/faculty/:facultySlug/course/:courseId" element={<CoursePage />} />
          <Route path="/campus/:campusSlug/lounge" element={<LoungePage />} />
          <Route path="/campus/:campusSlug/lounge/:threadId" element={<LoungeThreadPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </HashRouter>
  )
}
