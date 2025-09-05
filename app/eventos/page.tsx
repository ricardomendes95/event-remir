"use client";
import { useRouter } from "next/navigation";
import { JSX, useEffect } from "react";

const EventsPage = (): JSX.Element => {
  const { push } = useRouter();

  useEffect(() => {
    push("/");
  }, []);

  return <div>Eventos Page</div>;
};

export default EventsPage;
