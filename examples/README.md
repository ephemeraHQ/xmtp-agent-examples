# How to contribute an XMTP example

This guide explains how to help develop or improve an example using the XMTP protocol.

## Prerequisites

- Know Node.js and TypeScript
- Use Node.js version 20 or higher
- Use Yarn package manager

## Steps to Contribute

1. **Fork the repository**

   Fork the repository to your GitHub account.

2. **Clone your fork**

   Clone the repository to your computer.

   ```bash
   git clone https://github.com/your-username/xmtp-agent-examples.git
   cd xmtp-agent-examples
   ```

3. **Create a new branch**

   Make a new branch for your changes.

   ```bash
   git checkout -b example/your-example-name
   ```

4. **Install dependencies**

   Go to the example directory and install packages.

   ```bash
   cd examples/your-example
   yarn
   ```

5. **Make changes**

   Edit the `index.ts` file or other files.

6. **Test changes**

   Run the example to check your changes.

   ```bash
   yarn dev
   ```

7. **Commit changes**

   Save your changes with a message.

   ```bash
   git add .
   git commit -m "Add example: description of your example"
   ```

8. **Push changes**

   Send your changes to your forked repository.

   ```bash
   git push origin example/your-example-name
   ```

## Submit a Pull Request

1. **Create a pull request**

   Go to the original repository and make a pull request.

2. **Describe changes**

   Explain what you changed and why.

3. **Respond to feedback**

   Make more changes if needed.

## Code of Conduct

Follow the project's rules in all interactions.
