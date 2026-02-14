import {
  UIConfigProvider,
  UIProvider,
  type ButtonProps,
} from "@jamsr-ui/react";

type Props = {
  children: React.ReactNode;
};

const getButtonClassName = (variant: ButtonProps["variant"]) => {
  switch (variant) {
    case "outlined":
      return "bg-[#ffffff0d] text-[#ffffff80] border-1 border-[#ffffff33] backdrop-blur-[10px]";
    default:
      return "bg-white text-background";
  }
};

export const AppProvider: React.FC<Props> = ({ children }) => {
  return (
    <UIProvider>
      <UIConfigProvider
        //
        button={{
          radius: "full",
          size: "lg",
          props: ({ variant }) => {
            const buttonClassName = getButtonClassName(variant);
            return {
              className: `font-normal ${buttonClassName}`,
            };
          },
        }}
        //
        header={{
          className:
            "flex h-[60px] max-w-[90%] backdrop-blur-[10px] lg:max-w-screen-lg absolute rounded-full border border-[#ffffff33] top-10 container bg-[#ffffff0d] justify-between px-6",
        }}
        //
        link={{
          className: "text-foreground text-md hover:text-foreground/80",
        }}
      >
        {children}
      </UIConfigProvider>
    </UIProvider>
  );
};
