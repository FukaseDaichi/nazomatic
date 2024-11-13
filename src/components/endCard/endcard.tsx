"use client";

import {
  CardTitle,
  CardDescription,
  CardHeader,
  CardContent,
  CardFooter,
  Card,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useState } from "react";
import styles from "./endcard.module.css";
import html2canvas from "html2canvas";

export default function EndCard() {
  const [name, setName] = useState("");

  const createCard = () => {
    const endCard = document.getElementById("end-card");
    if (!endCard) {
      return;
    }
    html2canvas(endCard).then((canvas) => {
      console.log(canvas.toDataURL());
    });
  };

  return (
    <>
      <Card className="mx-auto my-10 w-[80%] max-w-[800px]">
        <CardHeader>
          <CardTitle>Create a End Card</CardTitle>
          <CardDescription>
            Design a beautiful card with your personalized message
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 flex flex-col items-center gap-6">
          <div className="w-full relative" id="end-card">
            <Image
              layout="responsive"
              src={"/img/saakoro/sara.png"}
              alt="エンドカード"
              quality={100}
              width={500}
              height={500}
            />
            <div className={`p-4 absolute top-1 left-1/2 ${styles.namearea}`}>
              <h2>{name}</h2>
            </div>
          </div>
          <div className="w-full grid gap-1.5">
            <Label htmlFor="name-content">Your Name</Label>
            <Input
              id="name-content"
              placeholder="Type your message here."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end p-4">
          <Button onClick={createCard}>Create Card</Button>
        </CardFooter>
      </Card>
    </>
  );
}
