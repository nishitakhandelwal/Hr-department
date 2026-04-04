import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { motion } from "framer-motion";
import { lettersApi, LetterItem } from "@/services/hrApi";
import { formatDate } from "@/lib/date";
import { downloadPdfBlob } from "@/utils/downloadPdf";

const EmployeeLetters: React.FC = () => {
  const [myLetters, setMyLetters] = useState<LetterItem[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const loadLetters = async () => {
      try {
        const response = await lettersApi.getMyLetters();
        setMyLetters(response);
      } catch (error) {
        console.error(error instanceof Error ? error.message : "Error loading letters", error);
      }
    };

    void loadLetters();
  }, []);

  const downloadLetter = async (id: string) => {
    try {
      setDownloadingId(id);

      const response = await lettersApi.downloadLetter(id);

      downloadPdfBlob(response.data, "letter.pdf");
    } catch (error) {
      console.error("Error downloading letter", error);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="p-6">
      <PageHeader title="Employee Letters" />

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">My Letters</h2>

        {myLetters.length === 0 ? (
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
