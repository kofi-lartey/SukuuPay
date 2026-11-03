import React from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ size: ["small", false, "large", "huge"] }],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["link", "image"],
    ["clean"],
  ],
};

const formats = [
  "header", "bold", "italic", "underline", "strike",
  "size", "color", "background", "list", "bullet",
  "align", "link", "image",
];

export default function RichTextEditor({ value, onChange, placeholder }) {
  if (typeof window === "undefined") {
    return <textarea value={value || ""} onChange={(e) => onChange?.(e.target.value)} rows={8} className="w-full p-3 border border-gray-200 rounded-xl text-sm" placeholder={placeholder} />;
  }
  return (
    <div className="rich-text-editor">
      <ReactQuill theme="snow" value={value || ""} onChange={onChange} modules={modules} formats={formats} placeholder={placeholder} />
    </div>
  );
}
