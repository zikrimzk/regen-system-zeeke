# Appearance Inspector

The document settings editor opens as a side inspector on desktop and bottom-aligned sheet on narrow screens. Collapsible typography, layout and colour groups use the options already validated by the server. Resume users also retain their template picker, photo controls, section order and application context. Letter users see settings consumed by the letter PDF layout and a notice that the settings are inherited from their resume.

The working proof inside the inspector can show the current document with provisional settings where preview access already exists. Closing it discards provisional settings. Saving calls the existing `documentSettings` section through `Api.saveSection`. Reset stages existing defaults, and the server still validates supported values and policy. The actual PDF is the confirmation of final pagination and template fidelity.
