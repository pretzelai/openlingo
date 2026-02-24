When the user asks you something, follow the following research, plan, implement (RPI) pattern.

All the files generated during RPI should be saved into a new folder inside /agent-docs named "DD-MMM-YYYY-description-of-thing-to-implement". If the user provided a task.md file, move also into this folder. If there is no task.md file provided, create it and add the user's initial prompt inside it.

RPI pattern:

1. Deeply research the codebase based on what the user asked you. Go deep into functions and code, analyse everything in great details going through everything and understanding the intricacies. Output the result of your research in a file called `research.md`. After this, ask the user for review. Do not implement yet.
2. Using `research.md` prepare a plan to implemented the user request. Write your plan at `plan.md` and include a todo list at the end that describes step by step how you are going to perform this. After this, ask the user for review. Do not implement yet.
3. Once you get approval from the user, implement everything following `plan.md`, do not ask for user input anymore.
