# Aurora Coffee Web Software

An online coffee store project for CS308 made with React, Tailwind, Node.JS and MySQL.

## Self Hosting Instructions

- Go to the frontend's directory
- `npm i`
- `npm run build`
- `npm run lint`
- Go to the backend's directory
- Configure the backend service by editing the [config.json](https://github.com/dsicim/AuroraCoffee/blob/main/Backend/config.json.example) file and remove `.example` from the name.
- `npm i`
- `node .`

## Structure

- `Frontend`: Website layout and interface for the end-users.
- `Database`: Storage of users, products and more information.
- `Backend`: Service that hosts the interface and lets users/admins interact with the database.