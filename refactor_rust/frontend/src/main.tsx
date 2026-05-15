import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./styles.css";
import { AppLayout, AuthLayout, PublicLayout } from "@/components/layout/Layouts";
import { Landing } from "@/routes/Landing";
import { SignIn, SignUp, ForgotPassword, ResetPassword, Onboarding } from "@/routes/Auth";
import { ChatPage } from "@/routes/Chat";
import { UnitsPage, BrowseUnitsPage, CoursePage, UnitPage, EditUnitPage } from "@/routes/Units";
import { LessonPage } from "@/routes/Lesson";
import { WordsPage } from "@/routes/Words";
import { ReadPage, ArticlePage } from "@/routes/Read";
import { SettingsPage } from "@/routes/Settings";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

const router = createBrowserRouter([
  { element: <PublicLayout />, children: [
    { path: "/", element: <Landing /> },
    { path: "/unit/:unitId", element: <UnitPage publicMode /> },
    { path: "/unit/:unitId/lesson/:lessonIndex", element: <LessonPage publicMode /> },
  ]},
  { element: <AuthLayout />, children: [
    { path: "/sign-in", element: <SignIn /> },
    { path: "/sign-up", element: <SignUp /> },
    { path: "/forgot-password", element: <ForgotPassword /> },
    { path: "/reset-password", element: <ResetPassword /> },
  ]},
  { element: <AppLayout />, children: [
    { path: "/onboarding", element: <Onboarding /> },
    { path: "/chat", element: <ChatPage /> },
    { path: "/chat/:id", element: <ChatPage /> },
    { path: "/units", element: <UnitsPage /> },
    { path: "/units/browse", element: <BrowseUnitsPage /> },
    { path: "/units/:courseId", element: <CoursePage /> },
    { path: "/units/edit/:unitId", element: <EditUnitPage /> },
    { path: "/lesson/:courseId/:unitId/:lessonIndex", element: <LessonPage /> },
    { path: "/words", element: <WordsPage /> },
    { path: "/read", element: <ReadPage /> },
    { path: "/read/:id", element: <ArticlePage /> },
    { path: "/settings", element: <SettingsPage /> },
  ]},
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
