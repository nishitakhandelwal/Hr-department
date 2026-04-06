import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { lettersApi, LetterItem } from "@/services/hrApi";
import { formatDate } from "@/lib/date";
import { downloadPdfBlob } from "@/utils/downloadPdf";

const EmployeeLetters: React.FC = () => {
  const { toast } = useToast();
  const [myLetters, setMyLetters] = useState<LetterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const loadLetters = async () => {
      try {
        setLoading(true);
        setErrorMessage("");
        const response = await lettersApi.getMyLetters();
        setMyLetters(response);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load letters.";
        setErrorMessage(message);
        toast({ title: "Letters unavailable", description: message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    void loadLetters();
  }, [toast]);

  const downloadLetter = async (id: string) => {
    try {
      setDownloadingId(id);

      const response = await lettersApi.downloadLetter(id);

      downloadPdfBlob(response.data, "letter.pdf");
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Unable to download letter.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="p-6">
      <PageHeader title="Employee Letters" />

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">My Letters</h2>

        {errorMessage ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{errorMessage}</p> : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading letters...</p>
        ) : myLetters.length === 0 ? (
          <p>No letters available.</p>
        ) : (
          <ul className="space-y-4">
            {myLetters.map((letter) => (
              <li
               key={letter._id}
                className="border p-4 rounded-lg flex justify-between items-center"
              >
                <div>
                  <h3 className="font-medium">{letter.title || letter.type || letter.letterNumber || "Letter"}</h3>
                  <p className="text-sm text-gray-500">
                    {formatDate(letter.issuedDate || letter.createdAt)}
                  </p>
                </div>

                <Button
                  onClick={() => downloadLetter(letter._id)}
                  disabled={downloadingId === letter._id}
                >
                  {downloadingId === letter._id ? (
                    <motion.span animate={{ opacity: 0.5 }}>
                      Downloading...
                    </motion.span>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Download Letter
                    </>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default EmployeeLetters;
