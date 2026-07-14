import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { AppLayout } from './components/layout/AppLayout'
import { PublicLayout } from './components/layout/PublicLayout'
import { Button } from './components/ui/Button'
import { EmptyState } from './components/ui/EmptyState'
import { AuthCallback } from './features/auth/AuthCallback'
import { AuthProvider } from './features/auth/useAuth'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { ResetPasswordPage } from './features/auth/ResetPasswordPage'
import { SignInPage } from './features/auth/SignInPage'
import { DashboardPage } from './features/dashboard/DashboardPage'
import { ApplicationsPage } from './features/admissions/ApplicationsPage'
import { CohortsPage } from './features/admissions/CohortsPage'
import { CourseBuilderPage } from './features/learning/CourseBuilderPage'
import { LearnPage } from './features/learning/LearnPage'
import { LessonPlayerPage } from './features/learning/LessonPlayerPage'
import { ReviewQueuePage } from './features/learning/ReviewQueuePage'
import { RoomDetailPage } from './features/learning/RoomDetailPage'
import { RoomsPage } from './features/learning/RoomsPage'
import { ClassSchedulePage } from './features/live/ClassSchedulePage'
import { ClassesAdminPage } from './features/live/ClassesAdminPage'
import { LiveClassPage } from './features/live/LiveClassPage'
import { ReplayPlayerPage, ReplaysPage } from './features/live/ReplaysPage'
import { BusinessRegisterPage } from './features/capstone/BusinessRegisterPage'
import { BusinessesAdminPage } from './features/capstone/BusinessesAdminPage'
import { CapstoneHubPage } from './features/capstone/CapstoneHubPage'
import { CapstonesReviewPage } from './features/capstone/CapstonesReviewPage'
import { PartnerPortalPage } from './features/capstone/PartnerPortalPage'
import { CoachPage } from './features/coach/CoachPage'
import { CommunityPage } from './features/community/CommunityPage'
import { LeaderboardPage } from './features/gamification/LeaderboardPage'
import { AdminDashboardPage } from './features/admin/AdminDashboardPage'
import { NotificationsPage } from './features/notifications/NotificationsPage'
import { SettingsNotificationsPage } from './features/notifications/SettingsNotificationsPage'
import { AnnouncementsPage } from './features/notifications/AnnouncementsPage'
import { OutcomesBoardPage } from './features/outcomes/OutcomesBoardPage'
import { ShowcasePage } from './features/outcomes/ShowcasePage'
import { ShowcaseAdminPage } from './features/outcomes/ShowcaseAdminPage'
import { CohortRosterPage } from './features/outcomes/CohortRosterPage'
import { CertificatePage } from './features/outcomes/CertificatePage'
import { VerifyPage } from './features/outcomes/VerifyPage'
import { AboutPage } from './features/public/AboutPage'
import { ApplyPage } from './features/public/ApplyPage'
import { ApplyStatusPage } from './features/public/ApplyStatusPage'
import { BusinessesPage } from './features/public/BusinessesPage'
import { FaqPage } from './features/public/FaqPage'
import { HomePage } from './features/public/HomePage'
import { ProgramPage } from './features/public/ProgramPage'

function NotFoundPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <EmptyState
        icon={Compass}
        message="This page doesn't exist."
        action={
          <Link to="/">
            <Button>Back to Home</Button>
          </Link>
        }
      />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/program" element={<ProgramPage />} />
            <Route path="/businesses" element={<BusinessesPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/apply" element={<ApplyPage />} />
            <Route path="/apply/status" element={<ApplyStatusPage />} />
            <Route path="/businesses/register" element={<BusinessRegisterPage />} />
            <Route path="/outcomes" element={<OutcomesBoardPage />} />
            <Route path="/outcomes/:slug" element={<ShowcasePage />} />
            <Route path="/verify" element={<VerifyPage />} />
            <Route path="/certificates/:code" element={<CertificatePage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/reset" element={<ResetPasswordPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/learn/lesson/:lessonId" element={<LessonPlayerPage />} />
            <Route path="/learn/classes" element={<ClassSchedulePage />} />
            <Route path="/learn/classes/:id" element={<LiveClassPage />} />
            <Route path="/learn/replays" element={<ReplaysPage />} />
            <Route path="/learn/replays/:id" element={<ReplayPlayerPage />} />
            <Route path="/learn/capstone" element={<CapstoneHubPage />} />
            <Route path="/community" element={<CommunityPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings/notifications" element={<SettingsNotificationsPage />} />
            <Route path="/learn/leaderboard" element={<LeaderboardPage />} />
            <Route path="/learn/coach" element={<CoachPage />} />
            <Route
              path="/partner"
              element={
                <ProtectedRoute allowedRoles={['business_partner']}>
                  <PartnerPortalPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin', 'instructor']}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teach/capstones"
              element={
                <ProtectedRoute allowedRoles={['admin', 'instructor']}>
                  <CapstonesReviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/businesses"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <BusinessesAdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/showcase"
              element={
                <ProtectedRoute allowedRoles={['admin', 'instructor']}>
                  <ShowcaseAdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teach/cohorts/:id/roster"
              element={
                <ProtectedRoute allowedRoles={['admin', 'instructor']}>
                  <CohortRosterPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teach/classes"
              element={
                <ProtectedRoute allowedRoles={['admin', 'instructor']}>
                  <ClassesAdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teach/review"
              element={
                <ProtectedRoute allowedRoles={['admin', 'instructor']}>
                  <ReviewQueuePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teach/announcements"
              element={
                <ProtectedRoute allowedRoles={['admin', 'instructor']}>
                  <AnnouncementsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/rooms"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <RoomsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/rooms/:id"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <RoomDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/courses/:id"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <CourseBuilderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/applications"
              element={
                <ProtectedRoute allowedRoles={['admin', 'instructor']}>
                  <ApplicationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/cohorts"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <CohortsPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
