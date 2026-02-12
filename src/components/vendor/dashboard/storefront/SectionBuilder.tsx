import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SectionBuilderProps {
  sections: string[];
  onSectionsChange: (sections: string[]) => void;
  isEditing: boolean;
}

const AVAILABLE_SECTIONS = [
  { id: 'hero', label: 'Hero Banner', description: 'Main banner with image/video' },
  { id: 'announcement', label: 'Announcement Bar', description: 'Top notification bar' },
  { id: 'featured', label: 'Featured Products', description: 'Hand-picked products' },
  { id: 'products', label: 'All Products', description: 'Full product grid' },
  { id: 'categories', label: 'Categories', description: 'Product categories' },
  { id: 'about', label: 'About Us', description: 'Brand story section' },
  { id: 'testimonials', label: 'Testimonials', description: 'Customer reviews' },
  { id: 'faq', label: 'FAQ', description: 'Common questions' },
  { id: 'newsletter', label: 'Newsletter Signup', description: 'Email capture' },
  { id: 'policies', label: 'Store Policies', description: 'Shipping & returns' },
  { id: 'social', label: 'Social Links', description: 'Social media links' },
  { id: 'video', label: 'Video Section', description: 'Embedded video content' },
  { id: 'cta', label: 'Call to Action', description: 'Promotional CTA block' },
];

const SortableSection: React.FC<{
  section: string;
  onRemove: () => void;
  isEditing: boolean;
}> = ({ section, onRemove, isEditing }) => {
  const sectionInfo = AVAILABLE_SECTIONS.find(s => s.id === section);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 bg-card border rounded-lg"
    >
      {isEditing && (
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
      <div className="flex-1">
        <p className="text-sm font-medium">{sectionInfo?.label || section}</p>
        <p className="text-xs text-muted-foreground">{sectionInfo?.description}</p>
      </div>
      {isEditing && (
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
};

const SectionBuilder: React.FC<SectionBuilderProps> = ({ sections, onSectionsChange, isEditing }) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const availableToAdd = AVAILABLE_SECTIONS.filter(s => !sections.includes(s.id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sections.indexOf(active.id as string);
      const newIndex = sections.indexOf(over.id as string);
      onSectionsChange(arrayMove(sections, oldIndex, newIndex));
    }
  };

  const addSection = (id: string) => {
    onSectionsChange([...sections, id]);
  };

  const removeSection = (id: string) => {
    onSectionsChange(sections.filter(s => s !== id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Homepage Layout Builder
          <Badge variant="outline" className="text-xs">Gold</Badge>
        </CardTitle>
        <CardDescription>Drag to reorder sections on your storefront homepage</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sections} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {sections.map(section => (
                <SortableSection
                  key={section}
                  section={section}
                  onRemove={() => removeSection(section)}
                  isEditing={isEditing}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {isEditing && availableToAdd.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Add Section</p>
            <div className="flex flex-wrap gap-2">
              {availableToAdd.map(section => (
                <Button
                  key={section.id}
                  variant="outline"
                  size="sm"
                  onClick={() => addSection(section.id)}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {section.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SectionBuilder;
