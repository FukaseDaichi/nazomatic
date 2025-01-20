import { Metadata as NextMetadata } from "next";

declare module "next" {
  interface Metadata extends NextMetadata {
    appleMobileWebAppTitle?: string;
    applicationName?: string;
    msapplicationTileColor?: string;
    themeColor?: string;
  }
}
