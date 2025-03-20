import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FullPageLoaderProps {
  customLoader?: React.ReactNode;
  className?: string;
}

export const FullPageLoader = ({
  customLoader,
  className,
}: FullPageLoaderProps) => {
  return (
    <div
      className={cn(
        "flex flex-col min-h-screen items-center justify-center bg-black text-white",
        className,
      )}>
      {customLoader || (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity }}
          className="w-10 h-10 rounded-full bg-white"
        />
      )}
    </div>
  );
};
