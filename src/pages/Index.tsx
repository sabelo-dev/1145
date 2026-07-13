import React from "react";
import ShopPage from "./ShopPage";

const Index = React.forwardRef<HTMLDivElement>((_, ref) => {
  return (
    <div ref={ref}>
      <ShopPage />
    </div>
  );
});

Index.displayName = "Index";

export default Index;
