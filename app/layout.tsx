import type { Metadata } from "next"
import { JetBrains_Mono, Inter } from "next/font/google"
import "./globals.css"
import { WalletProvider } from "@/components/WalletProvider"
import { Toaster } from "react-hot-toast"

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"],
  variable: '--font-mono'
})
const inter = Inter({ 
  subsets: ["latin"],
  variable: '--font-sans'
})

export const metadata: Metadata = {
  title: "Blueshift Governance - SIMD-0324: Alpenglow ",
  description: "Claim your vote tokens, vote to decide on the future of Solana, keep track of the SIMD governannce process.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${inter.variable}`}>
      <body className="font-sans min-h-screen">
        <WalletProvider>{children}</WalletProvider>
        <Toaster 
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1A1B1F',
              color: '#CDD1DB',
              border: '1px solid #2A2B30',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: {
              iconTheme: {
                primary: '#00FFFF',
                secondary: '#1A1B1F',
              },
            },
            error: {
              iconTheme: {
                primary: '#FFAD66',
                secondary: '#1A1B1F',
              },
            },
          }}
        />
      </body>
    </html>
  )
}