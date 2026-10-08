import React, { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import Card from '../../components/dashboard/ui/Card';
import { useToast } from '../../hooks/useToast';
import { useIdCardTemplates } from '../../hooks/useIdCardTemplates';
import { useAuth } from '../../context/AuthContext';
import TemplateCard from '../../components/settings/TemplateCard';
import TemplateEditorModal from '../../components/settings/TemplateEditorModal';

const IdCardTemplates = () => {
  const { user } = useAuth();
  const { success, error: errorToast, warning } = useToast();
  const schoolId = user?.schoolId;

  const {
    templates,
    loading,
    load,
    create,
    update,
    remove,
    duplicate,
    setDefault,
  } = useIdCardTemplates(schoolId);

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.audience.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (schoolId) {
      load();
    }
  }, [schoolId, load]);

  const handleCreate = async (data) => {
    try {
      await create(data);
      setIsModalOpen(false);
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleEdit = async (data) => {
    try {
      await update(editingTemplate._id, data);
      setEditingTemplate(null);
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleDuplicate = async (template) => {
    try {
      await duplicate(template._id);
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleDelete = async (template) => {
    if (template.isSystem) {
      warning('System templates cannot be deleted.');
      return;
    }
    if (!window.confirm(`Delete "${template.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await remove(template._id);
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleSetDefault = async (template) => {
    if (template.isSystem) {
      warning('Cannot set a system template as default.');
      return;
    }
    if (!window.confirm(`Set "${template.name}" as the default for ${template.audience}?`)) {
      return;
    }
    try {
      await setDefault(template._id);
    } catch (err) {
      // Error handled in hook
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-ink">ID Card Templates</h1>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-brand-800"
          >
            <Plus className="h-4 w-4" />
            New Template
          </button>
        </div>

        {/* Search */}
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search templates by name, audience, or slug…"
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-ink placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
          />
        </div>

        {/* Template cards grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <Card padding="p-6">
            <p className="text-center text-sm text-slate-500">
              No templates found. Create one to get started.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filteredTemplates.map((template) => (
              <TemplateCard
                key={template._id}
                template={template}
                onEdit={(t) => setEditingTemplate(t)}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onSetDefault={handleSetDefault}
              />
            ))}
          </div>
        )}

        {/* New Template Modal */}
        {isModalOpen && (
          <TemplateEditorModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSave={handleCreate}
            audience="student"
          />
        )}

        {/* Edit Template Modal */}
        {editingTemplate && (
          <TemplateEditorModal
            isOpen={true}
            onClose={() => setEditingTemplate(null)}
            onSave={handleEdit}
            audience="student"
            initialData={editingTemplate}
          />
        )}
      </div>
    </div>
  );
};

export default IdCardTemplates;
