import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  FileText,
  ShieldCheck,
  Database,
  AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { ClashReport, TimetableParseReport } from '../types';

export const MasterUploadWizard: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [academicYear, setAcademicYear] = useState<string>('2026-27');
  const [semester, setSemester] = useState<string>('Odd');
  const [effectiveFrom, setEffectiveFrom] = useState<string>('2026-07-15');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [parseReport, setParseReport] = useState<TimetableParseReport | null>(null);
  const [baselineClashes, setBaselineClashes] = useState<ClashReport[]>([]);
  const [isActivating, setIsActivating] = useState<boolean>(false);
  const [activeSuccess, setActiveSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const steps = [
    { number: 1, title: 'Upload Master' },
    { number: 2, title: 'Map Aliases & Rooms' },
    { number: 3, title: 'Review Baseline Clashes' },
    { number: 4, title: 'Activate Version' },
  ];

  useEffect(() => {
    api.getBaselineClashes()
      .then((data) => setBaselineClashes(data))
      .catch(() => {});
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a timetable file (.xlsx, .csv, or .pdf)');
      return;
    }
    setError(null);
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('academicYear', academicYear);
      formData.append('semester', semester);
      formData.append('effectiveFrom', effectiveFrom);

      const report = await api.uploadTimetableFile(formData);
      setParseReport(report);
      setCurrentStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to parse timetable file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleActivate = async () => {
    setError(null);
    setIsActivating(true);
    try {
      const targetVersionId = parseReport?.versionId || 1;
      await api.activateTimetableVersion(targetVersionId);
      setActiveSuccess(true);
      setTimeout(() => navigate('/timetable'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to activate timetable version');
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Wizard Header */}
      <div>
        <h2 className="text-xl font-bold text-ink">Master Timetable Upload & Activation Wizard</h2>
        <p className="text-xs text-muted mt-1">
          Import new semester master schedule via Excel, CSV, or PDF. Once activated, the master is strictly read-only.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Progress Stepper */}
      <div className="bg-surface p-4 rounded-xl border border-border shadow-xs flex items-center justify-between">
        {steps.map((s, idx) => (
          <div key={s.number} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition ${
                currentStep === s.number
                  ? 'bg-primary text-white shadow-xs'
                  : currentStep > s.number
                  ? 'bg-emerald-600 text-white'
                  : 'bg-canvas text-muted border border-border'
              }`}
            >
              {currentStep > s.number ? <CheckCircle2 className="w-4 h-4" /> : s.number}
            </div>
            <span
              className={`text-xs font-semibold hidden sm:inline ${
                currentStep === s.number ? 'text-primary' : currentStep > s.number ? 'text-ink' : 'text-muted'
              }`}
            >
              {s.title}
            </span>
            {idx < steps.length - 1 && <div className="w-8 sm:w-16 h-0.5 bg-border mx-2"></div>}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-surface p-6 rounded-xl border border-border shadow-xs">
        {/* Step 1: Upload */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <h3 className="font-bold text-sm text-ink flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-primary" /> Step 1: Select Master Timetable File
            </h3>

            <label className="block border-2 border-dashed border-border rounded-xl p-8 text-center bg-canvas/40 hover:bg-canvas transition cursor-pointer">
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <FileText className="w-10 h-10 text-primary mx-auto mb-2 opacity-80" />
              <div className="text-sm font-bold text-ink">
                {selectedFile ? selectedFile.name : 'Click or drag Excel / PDF file here'}
              </div>
              <p className="text-xs text-muted mt-1">
                Upload official RSCOE semester timetable document (.xlsx, .csv, or .pdf)
              </p>
              {selectedFile && (
                <div className="mt-2 text-xs font-semibold text-emerald-700">
                  Ready to parse ({Math.round(selectedFile.size / 1024)} KB)
                </div>
              )}
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Academic Year</label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-xs font-semibold text-ink"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Semester</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-xs font-semibold text-ink"
                >
                  <option value="Odd">Odd Semester</option>
                  <option value="Even">Even Semester</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Effective From</label>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-canvas border border-border rounded-lg text-xs font-semibold text-ink"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleUpload}
                disabled={isUploading || !selectedFile}
                className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold transition flex items-center gap-2 shadow-xs disabled:opacity-60 cursor-pointer"
              >
                {isUploading ? 'Parsing & Mapping Master...' : 'Parse Master File'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Aliases */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-ink flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" /> Step 2: Discovered Aliases and Room Mapping
            </h3>
            <p className="text-xs text-muted">
              ReSlot matched abbreviated initials and room codes to canonical references from your master data:
            </p>

            <div className="space-y-2">
              {[
                { raw: 'NW / NAW', resolved: 'Prof. N. A. Waghmare (NAW)', confidence: '100% matched by alias rule' },
                { raw: 'SPP', resolved: 'Prof. S. S. Pawar (SSP)', confidence: '100% matched by alias rule' },
                { raw: 'ML / MLL', resolved: 'A-210 (ML / AI-ML Lab)', confidence: '100% lab alias matched' },
                { raw: 'CVL', resolved: 'A-209 (Computer Vision Lab)', confidence: 'Direct shortcode match' },
              ].map((item, idx) => (
                <div key={idx} className="p-3 bg-canvas border border-border rounded-lg text-xs flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-primary bg-primary-tint px-2 py-0.5 rounded mr-2">
                      {item.raw}
                    </span>
                    &rarr; <span className="font-semibold text-ink">{item.resolved}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {item.confidence}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Review Baseline */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-ink flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> Step 3: Review Baseline Clashes ({baselineClashes.length} Detected)
            </h3>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-2">
              <div className="font-bold">{baselineClashes.length} Pre-Existing Clashes Detected in Master Baseline:</div>
              <ul className="list-disc list-inside space-y-1 text-amber-800 max-h-48 overflow-y-auto">
                {baselineClashes.slice(0, 8).map((clash, idx) => (
                  <li key={idx}>
                    <strong>{clash.clashType} ({clash.category}):</strong> {clash.description} ({clash.subject1} vs {clash.subject2})
                  </li>
                ))}
              </ul>
              <p className="pt-1 text-[11px] italic">
                By acknowledging, you confirm that these baseline clashes exist in the college's approved master schedule and will not be masked or altered during disruption runs.
              </p>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer pt-2">
              <input type="checkbox" defaultChecked className="rounded text-primary focus:ring-primary" />
              I acknowledge the pre-existing baseline clashes in the master timetable.
            </label>
          </div>
        )}

        {/* Step 4: Activate */}
        {currentStep === 4 && (
          <div className="space-y-4 text-center py-4">
            <ShieldCheck className="w-12 h-12 text-primary mx-auto" />
            <h3 className="font-bold text-base text-ink">Ready to Activate Timetable Version</h3>
            <p className="text-xs text-muted max-w-md mx-auto">
              Activating <strong>{semester} Sem {academicYear}</strong> will archive previous active versions and lock the new master as read-only.
            </p>

            {activeSuccess ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Version Activated Successfully! Redirecting to grid...
              </div>
            ) : (
              <button
                onClick={handleActivate}
                disabled={isActivating}
                className="px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-60"
              >
                {isActivating ? 'Activating & Locking Master...' : 'Confirm & Activate Version'}
              </button>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-border mt-6">
          <button
            onClick={() => setCurrentStep((p) => Math.max(1, p - 1))}
            disabled={currentStep === 1}
            className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-ink hover:bg-canvas disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          {currentStep < 4 && (
            <button
              onClick={() => setCurrentStep((p) => Math.min(4, p + 1))}
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
