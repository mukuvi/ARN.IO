import React from "react";
import Header from "./Header";
import Hero from "./Hero";
import Title from "./Title";
import heroData from "./heroData";

export default function Home() {
  const heroDataset = heroData.map((main) => {
    return (
      <>
        <Hero key={main.id} main={main} />
      </>
    );
  });
  return (
    <>
      <Header />
      <Title />
      <div className="heroMain">{heroDataset} </div>
    </>
  );
}
