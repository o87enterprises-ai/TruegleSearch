import React, { useState } from 'react';
import Modal, { ModalHeader, ModalBody, ModalFooter } from './Modal';
import Button from './NeonButton';

const ModalDemo = () => {
  const [modals, setModals] = useState({
    xs: false,
    sm: false,
    md: false,
    lg: false,
    xl: false,
    full: false,
    centered: false,
    positioned: false,
    scrollable: false,
  });

  const openModal = (key) => setModals((prev) => ({ ...prev, [key]: true }));
  const closeModal = (key) => setModals((prev) => ({ ...prev, [key]: false }));

  const LoremContent = () => (
    <div className="space-y-4">
      <p className="text-neutral-300">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
        incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
        nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
      </p>
      <p className="text-neutral-300">
        Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore
        eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident,
        sunt in culpa qui officia deserunt mollit anim id est laborum.
      </p>
      <p className="text-neutral-300">
        Sed ut perspiciatis unde omnis iste natus error sit voluptatem
        accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae
        ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt
        explicabo.
      </p>
      <div className="p-4 bg-neutral-800/50 rounded-xl border border-white/10">
        <h4 className="text-neutral-50 font-semibold mb-2">Key Features</h4>
        <ul className="text-neutral-400 space-y-2">
          <li>• Responsive design across all devices</li>
          <li>• Multiple size options</li>
          <li>• Position variants</li>
          <li>• Accessible keyboard navigation</li>
          <li>• Smooth animations</li>
        </ul>
      </div>
      <p className="text-neutral-300">
        Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut
        fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem
        sequi nesciunt.
      </p>
      <p className="text-neutral-300">
        Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet,
        consectetur, adipisci velit, sed quia non numquam eius modi tempora
        incidunt ut labore et dolore magnam aliquam quaerat voluptatem.
      </p>
    </div>
  );

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-3xl font-bold text-white">Modal Component Demo</h1>

      {/* Size Variants */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">Size Variants</h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => openModal('xs')}>Extra Small (xs)</Button>
          <Button onClick={() => openModal('sm')}>Small (sm)</Button>
          <Button onClick={() => openModal('md')}>Medium (md)</Button>
          <Button onClick={() => openModal('lg')}>Large (lg)</Button>
          <Button onClick={() => openModal('xl')}>Extra Large (xl)</Button>
          <Button onClick={() => openModal('full')}>Full Screen</Button>
        </div>
      </section>

      {/* Position Variants */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">Position Variants</h2>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => openModal('centered')}>Centered</Button>
          <Button onClick={() => openModal('positioned')}>Top Positioned</Button>
        </div>
      </section>

      {/* Scrollable Content */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-4">Scrollable Content</h2>
        <Button onClick={() => openModal('scrollable')}>Open with Long Content</Button>
      </section>

      {/* Size Modals */}
      <Modal
        isOpen={modals.xs}
        onClose={() => closeModal('xs')}
        size="xs"
      >
        <ModalHeader>Extra Small Modal</ModalHeader>
        <ModalBody>
          <p className="text-neutral-300">
            This is an extra small modal (400px max-width). Perfect for quick
            confirmations and short messages.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => closeModal('xs')} variant="secondary">
            Cancel
          </Button>
          <Button onClick={() => closeModal('xs')}>Confirm</Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={modals.sm}
        onClose={() => closeModal('sm')}
        size="sm"
      >
        <ModalHeader>Small Modal</ModalHeader>
        <ModalBody>
          <p className="text-neutral-300">
            This is a small modal (480px max-width). Good for simple forms and
            notifications.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => closeModal('sm')} variant="secondary">
            Cancel
          </Button>
          <Button onClick={() => closeModal('sm')}>Confirm</Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={modals.md}
        onClose={() => closeModal('md')}
        size="md"
      >
        <ModalHeader>Medium Modal</ModalHeader>
        <ModalBody>
          <p className="text-neutral-300">
            This is a medium modal (640px max-width). Ideal for most use cases
            including forms and detailed content.
          </p>
          <LoremContent />
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => closeModal('md')} variant="secondary">
            Cancel
          </Button>
          <Button onClick={() => closeModal('md')}>Confirm</Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={modals.lg}
        onClose={() => closeModal('lg')}
        size="lg"
      >
        <ModalHeader>Large Modal</ModalHeader>
        <ModalBody>
          <p className="text-neutral-300">
            This is a large modal (768px max-width). Great for complex content,
            multi-step forms, or data tables.
          </p>
          <LoremContent />
          <LoremContent />
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => closeModal('lg')} variant="secondary">
            Cancel
          </Button>
          <Button onClick={() => closeModal('lg')}>Confirm</Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={modals.xl}
        onClose={() => closeModal('xl')}
        size="xl"
      >
        <ModalHeader>Extra Large Modal</ModalHeader>
        <ModalBody>
          <p className="text-neutral-300">
            This is an extra large modal (1024px max-width). Perfect for
            presentations, dashboards, or extensive content.
          </p>
          <LoremContent />
          <LoremContent />
          <LoremContent />
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => closeModal('xl')} variant="secondary">
            Cancel
          </Button>
          <Button onClick={() => closeModal('xl')}>Confirm</Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={modals.full}
        onClose={() => closeModal('full')}
        size="full"
      >
        <ModalHeader>Full Screen Modal</ModalHeader>
        <ModalBody>
          <p className="text-neutral-300">
            This is a full screen modal. Great for immersive experiences like
            galleries, videos, or complex applications.
          </p>
          <LoremContent />
          <LoremContent />
          <LoremContent />
          <LoremContent />
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => closeModal('full')} variant="secondary">
            Cancel
          </Button>
          <Button onClick={() => closeModal('full')}>Confirm</Button>
        </ModalFooter>
      </Modal>

      {/* Position Modals */}
      <Modal
        isOpen={modals.centered}
        onClose={() => closeModal('centered')}
        size="md"
        position="center"
      >
        <ModalHeader>Centered Modal</ModalHeader>
        <ModalBody>
          <p className="text-neutral-300">
            This modal is centered in the viewport (default behavior).
          </p>
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => closeModal('centered')}>Close</Button>
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={modals.positioned}
        onClose={() => closeModal('positioned')}
        size="md"
        position="top"
      >
        <ModalHeader>Top Positioned Modal</ModalHeader>
        <ModalBody>
          <p className="text-neutral-300">
            This modal is positioned at the top of the viewport with some padding.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => closeModal('positioned')}>Close</Button>
        </ModalFooter>
      </Modal>

      {/* Scrollable Modal */}
      <Modal
        isOpen={modals.scrollable}
        onClose={() => closeModal('scrollable')}
        size="md"
      >
        <ModalHeader>Scrollable Modal</ModalHeader>
        <ModalBody scrollable={true}>
          <p className="text-neutral-300 mb-4">
            This modal contains a lot of content. When content exceeds the viewport
            height, it becomes scrollable.
          </p>
          <LoremContent />
          <LoremContent />
          <LoremContent />
          <LoremContent />
          <LoremContent />
        </ModalBody>
        <ModalFooter>
          <Button onClick={() => closeModal('scrollable')} variant="secondary">
            Cancel
          </Button>
          <Button onClick={() => closeModal('scrollable')}>Confirm</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default ModalDemo;
