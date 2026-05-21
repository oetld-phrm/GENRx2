import React from "react";

interface PageContainerProps {
  children: React.ReactNode;
}

/**
 * PageContainer Component
 * 
 * Viewport-locked container that prevents full-page scrolling.
 * Individual child components handle their own scrolling.
 */
const PageContainer = ({ children }: PageContainerProps) => {
  return (
    <div className="mx-auto flex flex-col min-h-screen max-h-screen h-screen overflow-hidden box-border bg-white">
      {children}
    </div>
  );
};

export default PageContainer;
