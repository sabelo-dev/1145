import React from "react";
import ServiceHubPage from "./ServiceHubPage";

const Index = React.forwardRef<HTMLDivElement>((_, ref) => {
  return (
    <div ref={ref}>
      <ServiceHubPage />
    </div>
  );
});

Index.displayName = "Index";

export default Index;
