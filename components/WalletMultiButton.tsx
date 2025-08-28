import React from "react";
import {
  BaseWalletMultiButton,
  type WalletMultiButton as WalletMultiButtonType,
} from "@solana/wallet-adapter-react-ui";

type ButtonProps = React.ComponentProps<typeof WalletMultiButtonType>;

const LABELS = {
  "change-wallet": "Change wallet",
  connecting: "Connecting ...",
  "copy-address": "Copy address",
  copied: "Copied",
  disconnect: "Disconnect",
  "has-wallet": "Connect",
  "no-wallet": "Connect Wallet",
} as const;

export function WalletMultiButton(props: ButtonProps) {
  return <BaseWalletMultiButton {...props} labels={LABELS} />;
}
