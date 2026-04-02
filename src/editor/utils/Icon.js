import { 
  createElement, 
  Move, RotateCw, Maximize, Magnet, Wand2, FlipHorizontal, FlipVertical, Type,
  Box, Circle, Cylinder, Cone, Torus, SquareDashed, Settings,
  Sun, Lightbulb, Globe, Camera, Sparkles,
  Save, FolderOpen, Archive, Play, Package,
  Undo2, Redo2, Pause, Square, Blocks, Volume2, Music, Image, Activity, MinusSquare, Target, Hash, Layers, Trash2, Copy, Pill
} from 'lucide';

export const IconRegistry = {
  // Toolbar modes
  'translate': Move,
  'rotate': RotateCw,
  'scale': Maximize,
  'snap': Magnet,
  'vertex-edit': Wand2,
  'sym-x': FlipHorizontal,
  'sym-y': FlipVertical,
  'sym-z': FlipVertical, // Will be rotated in createIcon
  
  // Shapes
  'add-box': Box,
  'add-sphere': Circle,
  'add-cylinder': Cylinder,
  'add-cone': Cone,
  'add-torus': Torus,
  'add-plane': SquareDashed,
  'add-capsule': Pill,
  
  // Actions
  'action-delete': Trash2,
  'action-duplicate': Copy,
  'action-focus': Target,
  
  // Entities
  'add-dirlight': Sun,
  'add-pointlight': Lightbulb,
  'add-camera': Camera,
  'add-particle': Sparkles,
  
  // Top menu
  'save': Save,
  'load': FolderOpen,
  'export': Archive,
  'preview': Play,
  'open-project': Package,
  'undo': Undo2,
  'redo': Redo2,
  
  // Play controls
  'play': Play,
  'pause': Pause,
  'stop': Square,
  
  // Components
  'Transform': Move,
  'ProceduralMesh': Blocks,
  'EditableMesh': Target,
  'MeshRenderer': Box,
  'Light': Lightbulb,
  'Script': Type,
  'RigidBody': Activity,
  'Collider': Box,
  'AudioListener': Volume2,
  'AudioSource': Music,
  'UICanvas': Image,
  'GLBModel': Package,
  'ParticleEmitter': Sparkles,
  'Animator': RotateCw,
  'AnimationPlayer': Play,
  'InstancedMeshRenderer': Blocks,
  'Environment': Globe,
  'Camera': Camera,
  
  // Defaults
  'default': Box
};

/**
 * Creates an SVG DOM element for the given icon name.
 * @param {string} name - The logical icon name from IconRegistry
 * @param {Object} props - Optional props (width, height, stroke-width, etc)
 * @returns {SVGElement}
 */
export function createIcon(name, props = {}) {
  const IconDef = IconRegistry[name] || IconRegistry['default'];
  const mergedProps = {
    width: 16,
    height: 16,
    'stroke-width': 2,
    ...props
  };
  
  const element = createElement(IconDef, mergedProps);
  
  // Custom transformations for specific logical icons
  if (name === 'sym-z') {
    element.style.transform = 'rotate(45deg)';
  }
  
  return element;
}
