"use client";
import dynamic from "next/dynamic";

// The log lives in the phone's local storage, so render it only in the browser.
export const MileageLoader = dynamic(() => import("./MileageApp"), {
  ssr: false,
  loading: () => <div className="mileage-app" aria-busy="true" />,
});
