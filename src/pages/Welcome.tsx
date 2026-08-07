import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Twitter, Instagram, Youtube, MessageCircle } from "lucide-react";
import investoursLogo from "@/assets/investours-logo.png";

const Welcome = () => {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden gradient-hero">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/3 rounded-full blur-2xl animate-float" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center z-10 px-6 max-w-2xl mx-auto w-full py-12 md:py-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8"
          >
            <img
              src={investoursLogo}
              alt="Investours Logo"
              className="w-32 h-32 mx-auto drop-shadow-lg"
            />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4"
          >
            Welcome to <span className="text-primary">Investours</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="text-lg md:text-xl text-primary font-medium mb-4"
          >
            AI for Financial Intelligence &amp; Income Mobility
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="text-base md:text-lg text-muted-foreground mb-10 leading-relaxed"
          >
            Access our AI-powered Livelihood Kit, discover income opportunities,
            connect with mentors, and grow through the Financial Health Ambassadors program.
          </motion.p>

          {/* Primary CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mb-6"
          >
            <Link to="/home">
              <Button variant="hero" size="xl" className="group">
                Get Started Now
                <motion.span
                  className="ml-2 inline-block"
                  animate={{ x: [0, 4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                >
                  →
                </motion.span>
              </Button>
            </Link>
          </motion.div>

          {/* Ambassadors CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="mb-16"
          >
            <Link to="/ambassador">
              <Button variant="outline" size="xl" className="group">
                Join Financial Health Ambassadors
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              Earn 30% first-time and 15% recurring commission while helping
              businesses and individuals improve their financial health with AI.
            </p>
          </motion.div>

          {/* Livelihood Kit */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
            className="mb-10"
          >
            <h2 className="text-lg font-bold text-foreground mb-5">Livelihood Kit</h2>
            <div className="flex flex-wrap items-center justify-center gap-4 text-muted-foreground text-sm">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-label="shield">🛡</span>
                <span>AI Financial Auditor</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-label="document">📄</span>
                <span>AI Business Planner</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-label="graduation cap">🎓</span>
                <span>AI Financial Tutor</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-label="rotating light">🚨</span>
                <span>Investment Scam Detector</span>
              </div>
            </div>
          </motion.div>

          {/* More Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.1 }}
            className="mb-16"
          >
            <h2 className="text-lg font-bold text-foreground mb-5">More Features</h2>
            <div className="flex flex-wrap items-center justify-center gap-4 text-muted-foreground text-sm">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-label="globe">🌍</span>
                <span>Opportunity Hub &amp; Mentorship</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-label="briefcase">💼</span>
                <span>Investment &amp; Microinsurance Marketplace (Coming Soon)</span>
              </div>
            </div>
          </motion.div>

          {/* Social Media Links */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.2 }}
          >
            <p className="text-sm text-muted-foreground mb-4">Follow us on social media</p>
            <div className="flex items-center justify-center gap-3">
              <a href="https://x.com/Investoursworld" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-secondary/80 hover:bg-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-all">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com/investoursworld/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-secondary/80 hover:bg-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-all">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="https://chat.whatsapp.com/Go5HpKeLiqz5NpPWLcVy1Q" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-secondary/80 hover:bg-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-all">
                <MessageCircle className="w-5 h-5" />
              </a>
              <a href="https://www.youtube.com/@Investoursworld" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-secondary/80 hover:bg-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary transition-all">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Welcome;
